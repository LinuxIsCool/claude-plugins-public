---
description: Show the weekly schedule summary and help manage schedule blocks
---

# Schedule Command

Show the user's weekly schedule summary. If no schedule is initialized, help them set one up.

## Instructions

1. First, check if a schedule exists using `block_list`
2. If it exists, use `schedule_summary` to show the overview
3. Include:
   - Total scheduled hours
   - Hours by category
   - Busiest days
4. Offer to help with common actions:
   - Add new blocks
   - Find free time
   - View specific days

## If No Schedule Exists

Guide the user to initialize:
1. Use `schedule_init` to create a new schedule
2. Suggest adding their first blocks
