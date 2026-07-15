import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.utils import score_buyer


class TestScoreBuyer:
    def test_with_history_weights_reviews_and_matches(self):
        score, basis = score_buyer(review_score=4.0, category_match_count=2)
        assert basis == "review_score_and_history"
        assert score == 0.6 * 4.0 + 0.4 * 2

    def test_falls_back_to_review_score_only_when_no_history(self):
        score, basis = score_buyer(review_score=4.5, category_match_count=0)
        assert basis == "review_score_only"
        assert score == 4.5

    def test_new_buyer_with_no_reviews_or_history_scores_zero(self):
        score, basis = score_buyer(review_score=None, category_match_count=0)
        assert basis == "review_score_only"
        assert score == 0.0

    def test_new_buyer_with_history_but_no_reviews_uses_neutral_baseline(self):
        score, basis = score_buyer(review_score=None, category_match_count=3)
        assert basis == "review_score_and_history"
        assert score == 0.6 * 2.5 + 0.4 * 3

    def test_category_match_count_is_capped(self):
        capped, _ = score_buyer(review_score=5.0, category_match_count=50)
        at_cap, _ = score_buyer(review_score=5.0, category_match_count=5)
        assert capped == at_cap
