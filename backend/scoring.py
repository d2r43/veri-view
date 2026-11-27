"""Small, dependency-free helpers for model output and frame aggregation."""


def fake_probability(predictions):
    """Return the model's AI/fake score as a percentage, or None if unknown."""
    scores = {item["label"].strip().lower(): float(item["score"]) for item in predictions}
    for label, score in scores.items():
        if label in {"ai", "fake", "fake image", "ai-generated", "synthetic"}:
            return round(score * 100, 2)
    for label, score in scores.items():
        if label in {"real", "real image", "authentic", "human"}:
            return round((1 - score) * 100, 2)
    return None


def verdict_for_score(score):
    if score > 60:
        return "FAKE"
    if score > 30:
        return "WARNING"
    return "REAL"


def aggregate_frame_scores(scores):
    """Mean the sampled-frame AI scores so the output has the same meaning."""
    usable_scores = [float(score) for score in scores if score is not None]
    if not usable_scores:
        return None
    score = round(sum(usable_scores) / len(usable_scores), 2)
    return {
        "score": score,
        "verdict": verdict_for_score(score),
        "frame_count": len(usable_scores),
        "frame_scores": [round(value, 2) for value in usable_scores],
    }
