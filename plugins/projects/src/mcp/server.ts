#!/usr/bin/env bun
/**
 * Project Manager MCP Server
 *
 * Provides project management tools via Model Context Protocol
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";

import { store } from "../store/markdown";
import { ensureDirectories, isInitialized, paths, loadConfig, saveConfig } from "../config";
import { calculatePriority, createDefaultContext, getUrgentProjects } from "../priority/calculator";
import type { CreateProjectInput, UpdateProjectInput, ProjectQuery, ProjectFilter, Deadline } from "../types";

import {
  projectCreateSchema,
  projectListSchema,
  projectGetSchema,
  projectUpdateSchema,
  projectDeleteSchema,
  projectSearchSchema,
  addMilestoneSchema,
  addDeliverableSchema,
  completeItemSchema,
  transitionStageSchema,
  addInvoiceSchema,
  markPaidSchema,
  financialSummarySchema,
  timelineSchema,
  projectInitSchema,
} from "./tools/schemas";

// =============================================================================
// Response Helpers
// =============================================================================

function textResponse(text: string) {
  return {
    content: [{ type: "text" as const, text }],
  };
}

function errorResponse(message: string) {
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}

function jsonResponse(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

// =============================================================================
// Main Server
// =============================================================================

async function main() {
  // Create MCP server
  const server = new Server(
    {
      name: "projects",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // Check if initialized
  const initialized = isInitialized();

  // Register tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools: Tool[] = [];

    // Always show init tool if not initialized
    if (!initialized) {
      tools.push({
        name: "project_init",
        description:
          "Initialize the projects directory. Required before using other project tools.",
        inputSchema: projectInitSchema,
      });
    }

    // Project CRUD
    tools.push(
      {
        name: "project_create",
        description:
          "Create a new project or opportunity. Specify type (assignment/opportunity), stage, and optional deadline/rate info.",
        inputSchema: projectCreateSchema,
      },
      {
        name: "project_list",
        description:
          "List projects with optional filtering by type, stage, priority, tags, client. Sorted by calculated priority by default.",
        inputSchema: projectListSchema,
      },
      {
        name: "project_get",
        description:
          "Get detailed information about a specific project including milestones, deliverables, and financials.",
        inputSchema: projectGetSchema,
      },
      {
        name: "project_update",
        description:
          "Update project fields. Can change title, type, stage, priority, deadline, client, tags, or add notes.",
        inputSchema: projectUpdateSchema,
      },
      {
        name: "project_delete",
        description: "Delete a project permanently.",
        inputSchema: projectDeleteSchema,
      },
      {
        name: "project_search",
        description:
          "Search projects by text. Matches title, description, client, notes, and tags.",
        inputSchema: projectSearchSchema,
      }
    );

    // Milestones & Deliverables
    tools.push(
      {
        name: "project_add_milestone",
        description:
          "Add a milestone to a project. Milestones have deadlines and can contain deliverables.",
        inputSchema: addMilestoneSchema,
      },
      {
        name: "project_add_deliverable",
        description: "Add a deliverable to a milestone within a project.",
        inputSchema: addDeliverableSchema,
      },
      {
        name: "project_complete_item",
        description:
          "Mark a milestone or deliverable as completed. Omit deliverable_id to complete the milestone.",
        inputSchema: completeItemSchema,
      }
    );

    // Stage transitions
    tools.push({
      name: "project_transition",
      description:
        "Transition a project to a new pipeline stage (lead → proposal → negotiation → active → delivered → closed).",
      inputSchema: transitionStageSchema,
    });

    // Financial
    tools.push(
      {
        name: "project_add_invoice",
        description: "Add an invoice to a project for financial tracking.",
        inputSchema: addInvoiceSchema,
      },
      {
        name: "project_mark_paid",
        description: "Mark an invoice as paid.",
        inputSchema: markPaidSchema,
      },
      {
        name: "project_financials",
        description:
          "Get a financial summary across all projects (total invoiced, received, outstanding).",
        inputSchema: financialSummarySchema,
      }
    );

    // Timeline
    tools.push({
      name: "project_timeline",
      description:
        "Get a timeline view of projects grouped by deadline proximity.",
      inputSchema: timelineSchema,
    });

    return { tools };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      // Handle init
      if (name === "project_init") {
        ensureDirectories();
        const config = loadConfig();
        if ((args as { default_currency?: string })?.default_currency) {
          config.default_currency = (args as { default_currency: string }).default_currency;
          saveConfig(config);
        }
        return textResponse(
          `Projects directory initialized at ${paths.base}\n\nDirectories created:\n- ${paths.active}\n- ${paths.opportunities}\n- ${paths.completed}\n\nYou can now create projects using project_create.`
        );
      }

      // All other tools require initialization
      if (!initialized && !isInitialized()) {
        return errorResponse(
          "Projects not initialized. Run project_init first."
        );
      }

      switch (name) {
        // =====================================================================
        // CRUD
        // =====================================================================
        case "project_create": {
          const input = args as {
            title: string;
            type: "assignment" | "opportunity";
            stage?: string;
            priority?: string;
            description?: string;
            client?: string;
            contact?: string;
            tags?: string[];
            deadline?: { date: string; time?: string; hard?: boolean };
            rate?: { type: string; amount?: number; currency?: string; estimated_hours?: number };
          };

          const createInput: CreateProjectInput = {
            title: input.title,
            type: input.type,
            stage: (input.stage as CreateProjectInput["stage"]) || "lead",
            priority: (input.priority as CreateProjectInput["priority"]) || "none",
            description: input.description,
            client: input.client,
            contact: input.contact,
            tags: input.tags || [],
            milestones: [],
          };

          if (input.deadline) {
            createInput.deadline = {
              date: input.deadline.date,
              time: input.deadline.time,
              hard: input.deadline.hard ?? true,
            };
          }

          if (input.rate) {
            const currency = input.rate.currency || "USD";
            createInput.financial = {
              rate: {
                type: input.rate.type as "hourly" | "fixed" | "retainer" | "equity",
                ...(input.rate.type === "hourly" && input.rate.amount
                  ? { hourly_rate: { amount: input.rate.amount, currency } }
                  : {}),
                ...(input.rate.type === "fixed" && input.rate.amount
                  ? { fixed_amount: { amount: input.rate.amount, currency } }
                  : {}),
                ...(input.rate.type === "retainer" && input.rate.amount
                  ? { retainer_monthly: { amount: input.rate.amount, currency } }
                  : {}),
                estimated_hours: input.rate.estimated_hours,
              },
              invoices: [],
              total_invoiced: { amount: 0, currency },
              total_received: { amount: 0, currency },
              outstanding: { amount: 0, currency },
            };
          }

          const project = await store.create(createInput);
          const score = calculatePriority(project, createDefaultContext());

          return textResponse(
            `Created project: ${project.title}\n\nID: ${project.id}\nType: ${project.type}\nStage: ${project.stage}\nPriority Score: ${score.total}/100\nFile: ${project.file_path}`
          );
        }

        case "project_list": {
          const input = args as {
            type?: string;
            stage?: string;
            priority?: string;
            tags?: string[];
            client?: string;
            overdue?: boolean;
            due_within_days?: number;
            min_priority?: number;
            sort_by?: string;
            sort_order?: "asc" | "desc";
            limit?: number;
          };

          const query: ProjectQuery = {
            filter: {
              type: input.type as ProjectFilter["type"],
              stage: input.stage as ProjectFilter["stage"],
              priority: input.priority as ProjectFilter["priority"],
              tags: input.tags,
              client: input.client,
              overdue: input.overdue,
              due_within_days: input.due_within_days,
              min_priority: input.min_priority,
            },
            sort_by: (input.sort_by as ProjectQuery["sort_by"]) || "priority",
            sort_order: input.sort_order,
            limit: input.limit,
          };

          const projects = await store.list(query);

          if (projects.length === 0) {
            return textResponse("No projects found matching the criteria.");
          }

          const lines = projects.map((p, i) => {
            const deadline = p.deadline ? ` (due: ${p.deadline.date})` : "";
            const client = p.client ? ` [${p.client}]` : "";
            return `${i + 1}. [${p.calculated_priority}] ${p.title}${client}${deadline}\n   ID: ${p.id} | Stage: ${p.stage} | Type: ${p.type}`;
          });

          return textResponse(
            `Found ${projects.length} project(s):\n\n${lines.join("\n\n")}`
          );
        }

        case "project_get": {
          const { id } = args as { id: string };
          const project = await store.get(id);

          if (!project) {
            return errorResponse(`Project not found: ${id}`);
          }

          const score = calculatePriority(project, createDefaultContext());

          return jsonResponse({
            ...project,
            priority_score: score,
          });
        }

        case "project_update": {
          const { id, ...updates } = args as { id: string } & UpdateProjectInput;
          const project = await store.update(id, updates);
          const score = calculatePriority(project, createDefaultContext());

          return textResponse(
            `Updated project: ${project.title}\n\nNew priority score: ${score.total}/100`
          );
        }

        case "project_delete": {
          const { id } = args as { id: string };
          const project = await store.get(id);

          if (!project) {
            return errorResponse(`Project not found: ${id}`);
          }

          await store.delete(id);
          return textResponse(`Deleted project: ${project.title}`);
        }

        case "project_search": {
          const { query } = args as { query: string };
          const projects = await store.search(query);

          if (projects.length === 0) {
            return textResponse(`No projects found matching: "${query}"`);
          }

          const lines = projects.map((p) => {
            return `- [${p.calculated_priority}] ${p.title} (${p.stage})\n  ID: ${p.id}`;
          });

          return textResponse(
            `Found ${projects.length} project(s) matching "${query}":\n\n${lines.join("\n\n")}`
          );
        }

        // =====================================================================
        // Milestones & Deliverables
        // =====================================================================
        case "project_add_milestone": {
          const input = args as {
            project_id: string;
            title: string;
            description?: string;
            deadline: { date: string; time?: string; hard?: boolean };
          };

          const milestone = await store.addMilestone(input.project_id, {
            title: input.title,
            description: input.description,
            deadline: {
              date: input.deadline.date,
              time: input.deadline.time,
              hard: input.deadline.hard ?? true,
            },
            deliverables: [],
            completed: false,
          });

          return textResponse(
            `Added milestone: ${milestone.title}\n\nID: ${milestone.id}\nDeadline: ${milestone.deadline.date}`
          );
        }

        case "project_add_deliverable": {
          const input = args as {
            project_id: string;
            milestone_id: string;
            title: string;
            description?: string;
            deadline?: { date: string; time?: string; hard?: boolean };
          };

          const deliverable = await store.addDeliverable(
            input.project_id,
            input.milestone_id,
            {
              title: input.title,
              description: input.description,
              deadline: input.deadline
                ? {
                    date: input.deadline.date,
                    time: input.deadline.time,
                    hard: input.deadline.hard ?? true,
                  }
                : undefined,
              completed: false,
            }
          );

          return textResponse(
            `Added deliverable: ${deliverable.title}\n\nID: ${deliverable.id}`
          );
        }

        case "project_complete_item": {
          const input = args as {
            project_id: string;
            milestone_id: string;
            deliverable_id?: string;
          };

          if (input.deliverable_id) {
            await store.completeDeliverable(
              input.project_id,
              input.milestone_id,
              input.deliverable_id
            );
            return textResponse(`Marked deliverable ${input.deliverable_id} as completed.`);
          } else {
            await store.completeMilestone(input.project_id, input.milestone_id);
            return textResponse(`Marked milestone ${input.milestone_id} as completed.`);
          }
        }

        // =====================================================================
        // Stage Transitions
        // =====================================================================
        case "project_transition": {
          const input = args as {
            id: string;
            stage: string;
            notes?: string;
          };

          const project = await store.transitionStage(
            input.id,
            input.stage as "lead" | "proposal" | "negotiation" | "active" | "delivered" | "closed",
            input.notes
          );

          return textResponse(
            `Transitioned "${project.title}" to ${input.stage}\n\nPriority: ${project.calculated_priority}/100`
          );
        }

        // =====================================================================
        // Financial
        // =====================================================================
        case "project_add_invoice": {
          const input = args as {
            project_id: string;
            amount: number;
            currency?: string;
            description?: string;
            date?: string;
          };

          const invoice = await store.addInvoice(input.project_id, {
            date: input.date || new Date().toISOString().split("T")[0],
            amount: {
              amount: input.amount,
              currency: input.currency || "USD",
            },
            description: input.description,
            paid: false,
          });

          return textResponse(
            `Added invoice: ${invoice.amount.currency} ${invoice.amount.amount}\n\nID: ${invoice.id}\nDate: ${invoice.date}`
          );
        }

        case "project_mark_paid": {
          const { project_id, invoice_id } = args as {
            project_id: string;
            invoice_id: string;
          };

          await store.markInvoicePaid(project_id, invoice_id);
          return textResponse(`Marked invoice ${invoice_id} as paid.`);
        }

        case "project_financials": {
          const input = args as { type?: string; stage?: string };

          const projects = await store.list({
            filter: {
              type: input.type as "assignment" | "opportunity",
              stage: input.stage as "lead" | "proposal" | "negotiation" | "active" | "delivered" | "closed",
            },
          });

          let totalInvoiced = 0;
          let totalReceived = 0;
          let totalOutstanding = 0;
          const byCurrency: Record<string, { invoiced: number; received: number; outstanding: number }> = {};

          for (const project of projects) {
            if (project.financial) {
              const currency = project.financial.total_invoiced.currency;
              if (!byCurrency[currency]) {
                byCurrency[currency] = { invoiced: 0, received: 0, outstanding: 0 };
              }
              byCurrency[currency].invoiced += project.financial.total_invoiced.amount;
              byCurrency[currency].received += project.financial.total_received.amount;
              byCurrency[currency].outstanding += project.financial.outstanding.amount;
            }
          }

          const lines = Object.entries(byCurrency).map(([currency, totals]) => {
            return `${currency}:\n  Invoiced: ${totals.invoiced.toFixed(2)}\n  Received: ${totals.received.toFixed(2)}\n  Outstanding: ${totals.outstanding.toFixed(2)}`;
          });

          if (lines.length === 0) {
            return textResponse("No financial data found for the selected projects.");
          }

          return textResponse(
            `Financial Summary (${projects.length} projects):\n\n${lines.join("\n\n")}`
          );
        }

        // =====================================================================
        // Timeline
        // =====================================================================
        case "project_timeline": {
          const input = args as { days_ahead?: number; include_overdue?: boolean };
          const daysAhead = input.days_ahead ?? 90;
          const includeOverdue = input.include_overdue ?? true;

          const allProjects = await store.list({});

          // Group by deadline proximity
          const overdue: typeof allProjects = [];
          const thisWeek: typeof allProjects = [];
          const thisMonth: typeof allProjects = [];
          const thisQuarter: typeof allProjects = [];
          const later: typeof allProjects = [];
          const noDeadline: typeof allProjects = [];

          const now = new Date();

          for (const project of allProjects) {
            if (project.stage === "closed") continue;

            if (!project.deadline) {
              noDeadline.push(project);
              continue;
            }

            const deadlineDate = new Date(project.deadline.date);
            const daysUntil = (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

            if (daysUntil < 0) {
              if (includeOverdue) overdue.push(project);
            } else if (daysUntil <= 7) {
              thisWeek.push(project);
            } else if (daysUntil <= 30) {
              thisMonth.push(project);
            } else if (daysUntil <= daysAhead) {
              thisQuarter.push(project);
            } else {
              later.push(project);
            }
          }

          const sections: string[] = [];

          if (overdue.length > 0) {
            sections.push(`## OVERDUE (${overdue.length})\n${overdue.map((p) => `- [${p.calculated_priority}] ${p.title} (due: ${p.deadline?.date})`).join("\n")}`);
          }

          if (thisWeek.length > 0) {
            sections.push(`## This Week (${thisWeek.length})\n${thisWeek.map((p) => `- [${p.calculated_priority}] ${p.title} (due: ${p.deadline?.date})`).join("\n")}`);
          }

          if (thisMonth.length > 0) {
            sections.push(`## This Month (${thisMonth.length})\n${thisMonth.map((p) => `- [${p.calculated_priority}] ${p.title} (due: ${p.deadline?.date})`).join("\n")}`);
          }

          if (thisQuarter.length > 0) {
            sections.push(`## Next ${daysAhead} Days (${thisQuarter.length})\n${thisQuarter.map((p) => `- [${p.calculated_priority}] ${p.title} (due: ${p.deadline?.date})`).join("\n")}`);
          }

          if (noDeadline.length > 0) {
            sections.push(`## No Deadline (${noDeadline.length})\n${noDeadline.map((p) => `- [${p.calculated_priority}] ${p.title}`).join("\n")}`);
          }

          return textResponse(
            sections.length > 0
              ? `# Project Timeline\n\n${sections.join("\n\n")}`
              : "No active projects found."
          );
        }

        default:
          return errorResponse(`Unknown tool: ${name}`);
      }
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : String(err));
    }
  });

  // Register resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: "projects://workflow/overview",
          name: "Projects Workflow Guide",
          description: "How to effectively manage projects with Claude",
          mimeType: "text/markdown",
        },
        {
          uri: "projects://priority/weights",
          name: "Priority Weights Configuration",
          description: "Current priority calculation weights",
          mimeType: "application/json",
        },
      ],
    };
  });

  // Handle resource reads
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    if (uri === "projects://workflow/overview") {
      return {
        contents: [
          {
            uri,
            mimeType: "text/markdown",
            text: `# Project Manager Workflow Guide

## Overview

The Projects plugin tracks projects and opportunities with real-time priority ranking based on:
- **Deadline urgency** (dominant factor - 40%)
- **Manual priority** (25%)
- **Financial value** (20%)
- **Recurrence boost** (10%)
- **Pipeline stage** (5%)

## Project Types

- **Assignment**: Committed work (contracts, deliverables, active engagements)
- **Opportunity**: Potential work (proposals, leads, prospects)

## Pipeline Stages

Lead → Proposal → Negotiation → Active → Delivered → Closed

## Quick Start

1. Create a project: \`project_create\`
2. Add milestones: \`project_add_milestone\`
3. Track progress: \`project_complete_item\`
4. Move through stages: \`project_transition\`
5. Track financials: \`project_add_invoice\`, \`project_mark_paid\`

## Priority Ranking

Projects are automatically ranked by calculated priority (0-100). Factors:
- Overdue items score 100 urgency
- Items due today score 95
- Financial value uses logarithmic scale
- Assignments score higher than opportunities
- Active stage multiplier is 1.0, leads are 0.4

## Integrations

Projects can reference:
- Schedule blocks (via schedule_blocks field)
- Backlog tasks (via backlog_tasks field)
- Related projects (via related_projects field)
`,
          },
        ],
      };
    }

    if (uri === "projects://priority/weights") {
      const config = loadConfig();
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(config.priority_weights, null, 2),
          },
        ],
      };
    }

    return {
      contents: [
        {
          uri,
          mimeType: "text/plain",
          text: `Resource not found: ${uri}`,
        },
      ],
    };
  });

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("Projects MCP server started");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
