"""
Indian Railways Train Priority & Operating Rules Configuration
Strictly documented as domain heuristics based on IR General & Subsidiary Rules (G&SR).
"""

# Priority Rank Hierarchy: Lower number = Higher priority
IR_PRIORITY_HIERARCHY = {
    "VANDE_BHARAT": {
        "rank": 1,
        "label": "Vande Bharat Express",
        "code_prefix": ["20", "22"],
        "max_speed_kmh": 130,
        "dwell_tolerance_mins": 2,
        "description": "Premium semi-high speed train with top track precedence."
    },
    "RAJDHANI_SHATABDI": {
        "rank": 1,
        "label": "Rajdhani / Shatabdi / Tejas",
        "code_prefix": ["120", "122", "124", "226"],
        "max_speed_kmh": 130,
        "dwell_tolerance_mins": 3,
        "description": "High-priority premier intercity/corridor express."
    },
    "SUPERFAST": {
        "rank": 2,
        "label": "Superfast Express / Duronto / Garib Rath",
        "code_prefix": ["125", "128", "228"],
        "max_speed_kmh": 110,
        "dwell_tolerance_mins": 5,
        "description": "Long-distance fast service with high priority over ordinary mail."
    },
    "MAIL_EXPRESS": {
        "rank": 3,
        "label": "Mail / Express / Intercity",
        "code_prefix": ["13", "14", "15"],
        "max_speed_kmh": 100,
        "dwell_tolerance_mins": 8,
        "description": "Regular mail/express network train."
    },
    "PASSENGER": {
        "rank": 4,
        "label": "Passenger / MEMU / DEMU",
        "code_prefix": ["04", "05", "54"],
        "max_speed_kmh": 80,
        "dwell_tolerance_mins": 10,
        "description": "Local/regional passenger service with frequent halts."
    },
    "FREIGHT": {
        "rank": 5,
        "label": "Freight / Goods / Container Rake",
        "code_prefix": ["BCN", "BOXN", "CONTR"],
        "max_speed_kmh": 65,
        "dwell_tolerance_mins": 20,
        "description": "Freight & goods rake. Precedence yields to all scheduled passenger services."
    }
}

# Standard safety headway and block clearance buffers
SAFETY_HEADWAY_KM = 2.5          # Minimum spatial safety distance between trains
PLATFORM_OCCUPANCY_BUFFER_MIN = 5 # Minimum clearance window between train arrival & departure on same platform
BLOCK_CLEARANCE_BUFFER_MIN = 3    # Time required for block overlap signal to reset to clear (green)

def get_train_category(train_number: str, train_name: str = "", train_class: str = "") -> dict:
    """Classify train category and priority ranking based on train number and class."""
    if train_class and train_class.upper() in IR_PRIORITY_HIERARCHY:
        return IR_PRIORITY_HIERARCHY[train_class.upper()]
    
    name_upper = (train_name or "").upper()
    if "VANDE BHARAT" in name_upper:
        return IR_PRIORITY_HIERARCHY["VANDE_BHARAT"]
    if "RAJDHANI" in name_upper or "SHATABDI" in name_upper or "TEJAS" in name_upper:
        return IR_PRIORITY_HIERARCHY["RAJDHANI_SHATABDI"]
    if "DURONTO" in name_upper or "GARIB RATH" in name_upper or "SUPERFAST" in name_upper or "SF" in name_upper:
        return IR_PRIORITY_HIERARCHY["SUPERFAST"]
    if "GOODS" in name_upper or "FREIGHT" in name_upper or "CONTAINER" in name_upper or "BOXN" in name_upper or "BCN" in name_upper:
        return IR_PRIORITY_HIERARCHY["FREIGHT"]
    if "PASSENGER" in name_upper or "MEMU" in name_upper or "DEMU" in name_upper:
        return IR_PRIORITY_HIERARCHY["PASSENGER"]
    
    # Check numeric prefixes
    t_str = str(train_number)
    for cat_key, cat_data in IR_PRIORITY_HIERARCHY.items():
        for prefix in cat_data["code_prefix"]:
            if t_str.startswith(prefix):
                return cat_data
                
    return IR_PRIORITY_HIERARCHY["MAIL_EXPRESS"]

def compare_train_priority(train_a: dict, train_b: dict) -> int:
    """
    Compare priority of two trains.
    Returns:
       1 if Train A has higher priority than Train B (Train B must yield)
      -1 if Train B has higher priority than Train A (Train A must yield)
       0 if equal priority (tie-breaker based on current delay or punctuality impact)
    """
    cat_a = get_train_category(train_a.get("number", ""), train_a.get("name", ""), train_a.get("class", ""))
    cat_b = get_train_category(train_b.get("number", ""), train_b.get("name", ""), train_b.get("class", ""))
    
    rank_a = cat_a["rank"]
    rank_b = cat_b["rank"]
    
    if rank_a < rank_b:
        return 1
    elif rank_a > rank_b:
        return -1
    else:
        # Tie-breaker: Train with lower current delay gets precedence to maintain punctuality,
        # or if one is running on time, do not delay the on-time train.
        delay_a = train_a.get("live_delay_minutes", 0)
        delay_b = train_b.get("live_delay_minutes", 0)
        if delay_a < delay_b:
            return 1
        elif delay_a > delay_b:
            return -1
        return 0
