from datetime import datetime, timedelta, timezone
from models.schemas import SRSResult


def interval_to_mastery_level(interval_days: int) -> int:
    """
    Map SM-2 interval (days until next review) to UI tier 0–5.

    Old formula ``interval // 7`` kept almost everything at 0 until interval ≥ 7,
    so tabs Beginner / Learning / … looked empty even after several reviews.
    """
    if interval_days <= 0:
        return 0
    if interval_days < 7:
        return 1  # Beginner — short spacing, still learning
    if interval_days < 14:
        return 2  # Learning
    if interval_days < 30:
        return 3  # Familiar
    if interval_days < 60:
        return 4  # Mastered
    return 5  # Expert


def calculate_next_review(ease_factor: float, interval: int, quality: int) -> SRSResult:
    """
    SM-2 spaced repetition algorithm.

    quality: 0-5
      0 = complete blackout
      1 = incorrect, remembered upon seeing answer
      2 = incorrect, easy to remember after
      3 = correct with serious difficulty
      4 = correct with hesitation
      5 = perfect recall

    interval: days until next review
    ease_factor: multiplier, min 1.3
    """
    if quality < 3:
        # Failed — reset to beginning
        interval = 1
    elif interval == 0:
        interval = 1
    elif interval == 1:
        interval = 6
    else:
        interval = round(interval * ease_factor)

    ease_factor = max(
        1.3,
        ease_factor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02),
    )

    # Failed reviews stay in tier 0 ("New") for filtering; successes tier by interval.
    if quality < 3:
        mastery_level = 0
    else:
        mastery_level = interval_to_mastery_level(interval)

    return SRSResult(
        interval=interval,
        ease_factor=round(ease_factor, 4),
        next_review_at=datetime.now(timezone.utc) + timedelta(days=interval),
        mastery_level=mastery_level,
    )


def get_initial_review() -> dict:
    """Default values for a brand-new vocabulary entry."""
    return {
        "interval_days": 0,
        "ease_factor": 2.5,
        "review_count": 0,
        "average_quality": 0.0,
        "mastery_level": 0,
        "next_review_at": datetime.now(timezone.utc).isoformat(),
    }


def update_average_quality(current_avg: float, review_count: int, new_quality: int) -> float:
    """Rolling average of quality scores."""
    return round(
        (current_avg * review_count + new_quality) / (review_count + 1),
        4,
    )
