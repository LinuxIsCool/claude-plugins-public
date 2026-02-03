/**
 * Markdown Store
 *
 * Persists projects as markdown files with YAML frontmatter.
 * Files are organized by type: active/, opportunities/, completed/
 */

import { readdir, readFile, writeFile, unlink, rename } from "fs/promises";
import { existsSync } from "fs";
import { join, basename } from "path";
import matter from "gray-matter";
import { nanoid } from "nanoid";

import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectQuery,
  ProjectFilter,
  Milestone,
  Deliverable,
  Invoice,
  ProjectStageValue,
  ProjectStore,
} from "../types";
import {
  paths,
  ensureDirectories,
  getProjectDirectory,
  loadConfig,
} from "../config";
import { calculatePriority, createDefaultContext, sortByPriority } from "../priority/calculator";

// =============================================================================
// ID Generation
// =============================================================================

/**
 * Generate a unique project ID
 */
function generateProjectId(): string {
  return `proj-${nanoid(8)}`;
}

/**
 * Generate a unique milestone ID
 */
function generateMilestoneId(): string {
  return `ms-${nanoid(6)}`;
}

/**
 * Generate a unique deliverable ID
 */
function generateDeliverableId(): string {
  return `del-${nanoid(6)}`;
}

/**
 * Generate a unique invoice ID
 */
function generateInvoiceId(): string {
  return `inv-${nanoid(6)}`;
}

// =============================================================================
// File Operations
// =============================================================================

/**
 * Convert project to filename
 */
function projectToFilename(project: Project): string {
  const safeTitle = project.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  return `${project.id}-${safeTitle}.md`;
}

/**
 * Parse a project from markdown content
 */
function parseProject(content: string, filePath: string): Project {
  const { data, content: notes } = matter(content);

  return {
    id: data.id || basename(filePath, ".md").split("-")[0],
    title: data.title || "Untitled Project",
    description: data.description,
    type: data.type || "assignment",
    stage: data.stage || "lead",
    priority: data.priority || "none",
    calculated_priority: data.calculated_priority,
    created_at: data.created_at || new Date().toISOString(),
    updated_at: data.updated_at || new Date().toISOString(),
    started_at: data.started_at,
    deadline: data.deadline,
    milestones: data.milestones || [],
    financial: data.financial,
    recurrence: data.recurrence,
    tags: data.tags || [],
    client: data.client,
    contact: data.contact,
    related_projects: data.related_projects,
    backlog_tasks: data.backlog_tasks,
    schedule_blocks: data.schedule_blocks,
    notes: notes.trim() || undefined,
    file_path: filePath,
  };
}

/**
 * Serialize a project to markdown content
 */
function serializeProject(project: Project): string {
  const { notes, file_path, ...frontmatter } = project;

  // Clean up undefined values
  const cleanFrontmatter = Object.fromEntries(
    Object.entries(frontmatter).filter(([, v]) => v !== undefined)
  );

  return matter.stringify(notes || "", cleanFrontmatter);
}

/**
 * Read all projects from a directory
 */
async function readProjectsFromDirectory(dirPath: string): Promise<Project[]> {
  if (!existsSync(dirPath)) return [];

  const files = await readdir(dirPath);
  const mdFiles = files.filter((f) => f.endsWith(".md"));

  const projects: Project[] = [];

  for (const file of mdFiles) {
    try {
      const filePath = join(dirPath, file);
      const content = await readFile(filePath, "utf-8");
      const project = parseProject(content, filePath);
      projects.push(project);
    } catch (err) {
      console.error(`Failed to read project ${file}:`, err);
    }
  }

  return projects;
}

/**
 * Get all projects from all directories
 */
async function getAllProjects(): Promise<Project[]> {
  ensureDirectories();

  const [active, opportunities, completed] = await Promise.all([
    readProjectsFromDirectory(paths.active),
    readProjectsFromDirectory(paths.opportunities),
    readProjectsFromDirectory(paths.completed),
  ]);

  return [...active, ...opportunities, ...completed];
}

// =============================================================================
// Filter & Sort
// =============================================================================

/**
 * Check if a value matches a filter (single value or array)
 */
function matchesFilter<T>(value: T, filter: T | T[] | undefined): boolean {
  if (filter === undefined) return true;
  if (Array.isArray(filter)) return filter.includes(value);
  return value === filter;
}

/**
 * Apply filters to a list of projects
 */
function applyFilters(projects: Project[], filter?: ProjectFilter): Project[] {
  if (!filter) return projects;

  return projects.filter((project) => {
    // Type filter
    if (!matchesFilter(project.type, filter.type)) return false;

    // Stage filter
    if (!matchesFilter(project.stage, filter.stage)) return false;

    // Priority filter
    if (!matchesFilter(project.priority, filter.priority)) return false;

    // Tags filter (match any)
    if (filter.tags && filter.tags.length > 0) {
      const hasMatchingTag = filter.tags.some((tag) =>
        project.tags.includes(tag)
      );
      if (!hasMatchingTag) return false;
    }

    // Client filter
    if (filter.client && project.client !== filter.client) return false;

    // Has deadline filter
    if (filter.has_deadline !== undefined) {
      const hasDeadline = !!project.deadline;
      if (hasDeadline !== filter.has_deadline) return false;
    }

    // Overdue filter
    if (filter.overdue !== undefined) {
      const isOverdue =
        project.deadline &&
        new Date(project.deadline.date) < new Date() &&
        project.stage !== "closed";
      if (!!isOverdue !== filter.overdue) return false;
    }

    // Due within days filter
    if (filter.due_within_days !== undefined && project.deadline) {
      const daysUntil =
        (new Date(project.deadline.date).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24);
      if (daysUntil > filter.due_within_days) return false;
    }

    // Min priority filter
    if (filter.min_priority !== undefined) {
      const score = calculatePriority(project, createDefaultContext());
      if (score.total < filter.min_priority) return false;
    }

    return true;
  });
}

/**
 * Apply sorting to a list of projects
 */
function applySorting(
  projects: Project[],
  sortBy?: string,
  sortOrder?: "asc" | "desc"
): Project[] {
  if (!sortBy || sortBy === "priority") {
    return sortByPriority(projects);
  }

  const sorted = [...projects].sort((a, b) => {
    switch (sortBy) {
      case "deadline":
        const aDeadline = a.deadline?.date || "9999-12-31";
        const bDeadline = b.deadline?.date || "9999-12-31";
        return aDeadline.localeCompare(bDeadline);

      case "created":
        return a.created_at.localeCompare(b.created_at);

      case "updated":
        return a.updated_at.localeCompare(b.updated_at);

      case "stage":
        const stageOrder = [
          "lead",
          "proposal",
          "negotiation",
          "active",
          "delivered",
          "closed",
        ];
        return stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage);

      case "title":
        return a.title.localeCompare(b.title);

      default:
        return 0;
    }
  });

  return sortOrder === "desc" ? sorted.reverse() : sorted;
}

// =============================================================================
// Store Implementation
// =============================================================================

/**
 * Create the markdown-based project store
 */
export function createMarkdownStore(): ProjectStore {
  return {
    // =========================================================================
    // CRUD Operations
    // =========================================================================

    async create(input: CreateProjectInput): Promise<Project> {
      ensureDirectories();

      const now = new Date().toISOString();
      const project: Project = {
        ...input,
        id: generateProjectId(),
        created_at: now,
        updated_at: now,
        milestones: input.milestones || [],
        tags: input.tags || [],
      };

      // Calculate initial priority
      project.calculated_priority = calculatePriority(
        project,
        createDefaultContext()
      ).total;

      // Determine directory based on type and stage
      const dir = getProjectDirectory(project.type, project.stage);
      const filename = projectToFilename(project);
      const filePath = join(dir, filename);

      project.file_path = filePath;

      // Write file
      const content = serializeProject(project);
      await writeFile(filePath, content, "utf-8");

      return project;
    },

    async get(id: string): Promise<Project | null> {
      const projects = await getAllProjects();
      return projects.find((p) => p.id === id) || null;
    },

    async update(id: string, input: UpdateProjectInput): Promise<Project> {
      const project = await this.get(id);
      if (!project) {
        throw new Error(`Project not found: ${id}`);
      }

      // Merge updates
      const updated: Project = {
        ...project,
        ...input,
        id: project.id, // Preserve ID
        created_at: project.created_at, // Preserve creation time
        updated_at: new Date().toISOString(),
      };

      // Recalculate priority
      updated.calculated_priority = calculatePriority(
        updated,
        createDefaultContext()
      ).total;

      // Check if we need to move the file
      const currentDir = getProjectDirectory(project.type, project.stage);
      const newDir = getProjectDirectory(updated.type, updated.stage);
      const filename = projectToFilename(updated);
      const newPath = join(newDir, filename);

      // Delete old file if path changed
      if (project.file_path && project.file_path !== newPath) {
        try {
          await unlink(project.file_path);
        } catch {
          // Ignore if file doesn't exist
        }
      }

      updated.file_path = newPath;

      // Write updated file
      const content = serializeProject(updated);
      await writeFile(newPath, content, "utf-8");

      return updated;
    },

    async delete(id: string): Promise<void> {
      const project = await this.get(id);
      if (!project) {
        throw new Error(`Project not found: ${id}`);
      }

      if (project.file_path) {
        await unlink(project.file_path);
      }
    },

    async archive(id: string): Promise<void> {
      await this.update(id, { stage: "closed" });
    },

    // =========================================================================
    // Queries
    // =========================================================================

    async list(query?: ProjectQuery): Promise<Project[]> {
      let projects = await getAllProjects();

      // Apply filters
      projects = applyFilters(projects, query?.filter);

      // Apply sorting
      projects = applySorting(projects, query?.sort_by, query?.sort_order);

      // Apply pagination
      if (query?.offset) {
        projects = projects.slice(query.offset);
      }
      if (query?.limit) {
        projects = projects.slice(0, query.limit);
      }

      return projects;
    },

    async search(text: string): Promise<Project[]> {
      const projects = await getAllProjects();
      const searchLower = text.toLowerCase();

      const results = projects.filter((project) => {
        return (
          project.title.toLowerCase().includes(searchLower) ||
          project.description?.toLowerCase().includes(searchLower) ||
          project.client?.toLowerCase().includes(searchLower) ||
          project.notes?.toLowerCase().includes(searchLower) ||
          project.tags.some((tag) => tag.toLowerCase().includes(searchLower))
        );
      });

      return sortByPriority(results);
    },

    // =========================================================================
    // Milestones
    // =========================================================================

    async addMilestone(
      projectId: string,
      milestone: Omit<Milestone, "id">
    ): Promise<Milestone> {
      const project = await this.get(projectId);
      if (!project) {
        throw new Error(`Project not found: ${projectId}`);
      }

      const newMilestone: Milestone = {
        ...milestone,
        id: generateMilestoneId(),
        deliverables: milestone.deliverables || [],
        completed: milestone.completed || false,
      };

      project.milestones.push(newMilestone);
      await this.update(projectId, { milestones: project.milestones });

      return newMilestone;
    },

    async updateMilestone(
      projectId: string,
      milestoneId: string,
      updates: Partial<Milestone>
    ): Promise<Milestone> {
      const project = await this.get(projectId);
      if (!project) {
        throw new Error(`Project not found: ${projectId}`);
      }

      const milestoneIndex = project.milestones.findIndex(
        (m) => m.id === milestoneId
      );
      if (milestoneIndex === -1) {
        throw new Error(`Milestone not found: ${milestoneId}`);
      }

      const updated = {
        ...project.milestones[milestoneIndex],
        ...updates,
        id: milestoneId, // Preserve ID
      };
      project.milestones[milestoneIndex] = updated;

      await this.update(projectId, { milestones: project.milestones });

      return updated;
    },

    async completeMilestone(projectId: string, milestoneId: string): Promise<void> {
      await this.updateMilestone(projectId, milestoneId, {
        completed: true,
        completed_at: new Date().toISOString(),
      });
    },

    // =========================================================================
    // Deliverables
    // =========================================================================

    async addDeliverable(
      projectId: string,
      milestoneId: string,
      deliverable: Omit<Deliverable, "id">
    ): Promise<Deliverable> {
      const project = await this.get(projectId);
      if (!project) {
        throw new Error(`Project not found: ${projectId}`);
      }

      const milestone = project.milestones.find((m) => m.id === milestoneId);
      if (!milestone) {
        throw new Error(`Milestone not found: ${milestoneId}`);
      }

      const newDeliverable: Deliverable = {
        ...deliverable,
        id: generateDeliverableId(),
        completed: deliverable.completed || false,
      };

      milestone.deliverables.push(newDeliverable);
      await this.update(projectId, { milestones: project.milestones });

      return newDeliverable;
    },

    async completeDeliverable(
      projectId: string,
      milestoneId: string,
      deliverableId: string
    ): Promise<void> {
      const project = await this.get(projectId);
      if (!project) {
        throw new Error(`Project not found: ${projectId}`);
      }

      const milestone = project.milestones.find((m) => m.id === milestoneId);
      if (!milestone) {
        throw new Error(`Milestone not found: ${milestoneId}`);
      }

      const deliverable = milestone.deliverables.find(
        (d) => d.id === deliverableId
      );
      if (!deliverable) {
        throw new Error(`Deliverable not found: ${deliverableId}`);
      }

      deliverable.completed = true;
      deliverable.completed_at = new Date().toISOString();

      await this.update(projectId, { milestones: project.milestones });
    },

    // =========================================================================
    // Stage Transitions
    // =========================================================================

    async transitionStage(
      projectId: string,
      newStage: ProjectStageValue,
      notes?: string
    ): Promise<Project> {
      const project = await this.get(projectId);
      if (!project) {
        throw new Error(`Project not found: ${projectId}`);
      }

      const updates: UpdateProjectInput = {
        stage: newStage,
      };

      // Set started_at when moving to active
      if (newStage === "active" && !project.started_at) {
        updates.started_at = new Date().toISOString();
      }

      // Append transition notes if provided
      if (notes) {
        const existingNotes = project.notes || "";
        const timestamp = new Date().toISOString().split("T")[0];
        updates.notes = `${existingNotes}\n\n## ${timestamp}: Stage → ${newStage}\n\n${notes}`.trim();
      }

      return this.update(projectId, updates);
    },

    // =========================================================================
    // Financial
    // =========================================================================

    async addInvoice(
      projectId: string,
      invoice: Omit<Invoice, "id">
    ): Promise<Invoice> {
      const project = await this.get(projectId);
      if (!project) {
        throw new Error(`Project not found: ${projectId}`);
      }

      const newInvoice: Invoice = {
        ...invoice,
        id: generateInvoiceId(),
        paid: invoice.paid || false,
      };

      // Initialize financial tracking if needed
      if (!project.financial) {
        const config = loadConfig();
        project.financial = {
          rate: { type: "fixed" },
          invoices: [],
          total_invoiced: { amount: 0, currency: config.default_currency },
          total_received: { amount: 0, currency: config.default_currency },
          outstanding: { amount: 0, currency: config.default_currency },
        };
      }

      // Validate currency matches project's financial currency
      const projectCurrency = project.financial.total_invoiced.currency;
      if (newInvoice.amount.currency !== projectCurrency) {
        throw new Error(
          `Invoice currency (${newInvoice.amount.currency}) does not match project currency (${projectCurrency}). ` +
          `All invoices for a project must use the same currency.`
        );
      }

      project.financial.invoices.push(newInvoice);

      // Recalculate totals (all invoices use same currency)
      project.financial.total_invoiced.amount = project.financial.invoices.reduce(
        (sum, inv) => sum + inv.amount.amount,
        0
      );
      project.financial.total_received.amount = project.financial.invoices
        .filter((inv) => inv.paid)
        .reduce((sum, inv) => sum + inv.amount.amount, 0);
      project.financial.outstanding.amount =
        project.financial.total_invoiced.amount -
        project.financial.total_received.amount;

      await this.update(projectId, { financial: project.financial });

      return newInvoice;
    },

    async markInvoicePaid(projectId: string, invoiceId: string): Promise<void> {
      const project = await this.get(projectId);
      if (!project || !project.financial) {
        throw new Error(`Project not found: ${projectId}`);
      }

      const invoice = project.financial.invoices.find((i) => i.id === invoiceId);
      if (!invoice) {
        throw new Error(`Invoice not found: ${invoiceId}`);
      }

      invoice.paid = true;
      invoice.paid_date = new Date().toISOString();

      // Recalculate totals
      project.financial.total_received.amount = project.financial.invoices
        .filter((inv) => inv.paid)
        .reduce((sum, inv) => sum + inv.amount.amount, 0);
      project.financial.outstanding.amount =
        project.financial.total_invoiced.amount -
        project.financial.total_received.amount;

      await this.update(projectId, { financial: project.financial });
    },
  };
}

/**
 * Export a singleton instance
 */
export const store = createMarkdownStore();
