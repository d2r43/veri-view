"""Tests for model-label handling and video frame score aggregation."""
import unittest

from scoring import aggregate_frame_scores, fake_probability, verdict_for_score


class ScoringTests(unittest.TestCase):
    def test_ai_label_maps_to_fake_probability(self):
        self.assertEqual(fake_probability([
            {"label": "Real", "score": 0.91},
            {"label": "AI", "score": 0.09},
        ]), 9.0)

    def test_real_label_is_inverted_when_ai_label_is_missing(self):
        self.assertEqual(fake_probability([{"label": "Real", "score": 0.82}]), 18.0)

    def test_unknown_label_does_not_claim_a_confidence(self):
        self.assertIsNone(fake_probability([{"label": "LABEL_0", "score": 0.82}]))

    def test_frame_scores_are_averaged_and_keep_count(self):
        self.assertEqual(aggregate_frame_scores([10, 20, 30]), {
            "score": 20.0, "verdict": "REAL", "frame_count": 3,
            "frame_scores": [10.0, 20.0, 30.0],
        })

    def test_no_frame_scores_returns_no_result(self):
        self.assertIsNone(aggregate_frame_scores([None, None]))

    def test_thresholds_preserve_inconclusive_band(self):
        self.assertEqual(verdict_for_score(30), "REAL")
        self.assertEqual(verdict_for_score(31), "WARNING")
        self.assertEqual(verdict_for_score(60), "WARNING")
        self.assertEqual(verdict_for_score(61), "FAKE")


if __name__ == "__main__":
    unittest.main()
