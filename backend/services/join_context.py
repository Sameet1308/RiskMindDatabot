"""
Join context derived from docs/Data-Model.md.
Defines allowed join paths between entities for SQL planning.
"""

JOIN_GRAPH = {
    "policies": {
        "claims": "policies.id = claims.policy_id",
        "decisions": "policies.policy_number = decisions.policy_number",
    },
    "claims": {
        "policies": "claims.policy_id = policies.id",
    },
    "decisions": {
        "policies": "decisions.policy_number = policies.policy_number",
    },
    "guidelines": {},
    "documents": {},
    "users": {},
}

ENTITY_TABLES = {
    "policy": "policies",
    "claim": "claims",
    "portfolio": "policies",
    "guideline": "guidelines",
    "decision": "decisions",
}
