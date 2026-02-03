#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "falkordb",
# ]
# ///
"""
Explore the git history knowledge graph.
"""

from falkordb import FalkorDB

def main():
    db = FalkorDB(host='localhost', port=6380)
    g = db.select_graph('git_history')

    print('=== QUALITY EVOLUTION OVER TIME ===')
    result = g.query('''
        MATCH (c:Commit)
        WITH substring(c.timestamp, 0, 10) as day,
             avg(c.integrity_score) as avg_integrity,
             avg(c.contribution_score) as avg_contribution,
             count(c) as commits
        RETURN day, commits, avg_integrity, avg_contribution
        ORDER BY day
    ''')
    for row in result.result_set:
        print(f'{row[0]}: {int(row[1])} commits | Integrity: {row[2]:.2f} | Contribution: {row[3]:.2f}')

    print()
    print('=== PLUGIN ACTIVITY (commits per plugin directory) ===')
    result = g.query('''
        MATCH (c:Commit)-[:MODIFIED]->(f:File)
        WHERE f.directory STARTS WITH "plugins/"
        WITH split(f.directory, "/")[1] as plugin, count(DISTINCT c) as commits
        RETURN plugin, commits
        ORDER BY commits DESC
    ''')
    for row in result.result_set:
        print(f'  {row[0]}: {row[1]} commits')

    print()
    print('=== PLUGIN INTRODUCTION TIMELINE ===')
    result = g.query('''
        MATCH (c:Commit)-[:MODIFIED]->(f:File)
        WHERE f.directory STARTS WITH "plugins/"
        WITH split(f.directory, "/")[1] as plugin, c
        ORDER BY c.timestamp
        WITH plugin, collect(c)[0] as first_commit
        RETURN plugin, first_commit.timestamp, first_commit.subject
        ORDER BY first_commit.timestamp
    ''')
    for row in result.result_set:
        print(f'  {row[0]}: {row[1][:16]} | {row[2][:45]}...')

    print()
    print('=== HOTSPOT FILES (most modifications) ===')
    result = g.query('''
        MATCH (c:Commit)-[:MODIFIED]->(f:File)
        WITH f, count(c) as mods
        WHERE mods > 3
        RETURN f.path, mods
        ORDER BY mods DESC
        LIMIT 10
    ''')
    for row in result.result_set:
        print(f'  {row[1]}x | {row[0]}')

    print()
    print('=== COMMIT VELOCITY (by hour on Dec 8) ===')
    result = g.query('''
        MATCH (c:Commit)
        WHERE c.timestamp STARTS WITH "2025-12-08"
        WITH substring(c.timestamp, 11, 2) as hour, count(c) as commits
        RETURN hour, commits
        ORDER BY hour
    ''')
    print('  Hour | Commits')
    print('  -----|--------')
    for row in result.result_set:
        bar = '#' * int(row[1])
        print(f'  {row[0]}   | {row[1]} {bar}')

    print()
    print('=== AVERAGE SCORES ===')
    result = g.query('''
        MATCH (c:Commit)
        RETURN avg(c.integrity_score) as avg_integrity,
               avg(c.contribution_score) as avg_contribution,
               avg(c.complexity_score) as avg_complexity
    ''')
    row = result.result_set[0]
    print(f'  Average Integrity:    {row[0]:.2f}')
    print(f'  Average Contribution: {row[1]:.2f}')
    print(f'  Average Complexity:   {row[2]:.2f}')

    print()
    print('=== LOWEST INTEGRITY COMMITS (potential improvement areas) ===')
    result = g.query('''
        MATCH (c:Commit)
        WHERE c.integrity_score < 0.5
        RETURN c.short_hash, c.integrity_score, c.subject
        ORDER BY c.integrity_score
        LIMIT 5
    ''')
    for row in result.result_set:
        print(f'  {row[0]} | I:{row[1]:.2f} | {row[2][:45]}...')


if __name__ == '__main__':
    main()
