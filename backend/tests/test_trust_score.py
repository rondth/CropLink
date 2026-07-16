import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.utils import calculate_trust_score, describe_trust_score, TRUST_SCORE_NEUTRAL


class TestCalculateTrustScore:
    def test_blends_all_three_components(self):
        score = calculate_trust_score(review_avg=4.0, payment_success_rate=1.0, completion_rate=1.0)
        assert score == round(0.5 * 4.0 + 0.3 * 5 + 0.2 * 5, 2)

    def test_new_user_with_no_history_gets_neutral_baseline(self):
        score = calculate_trust_score(review_avg=None, payment_success_rate=None, completion_rate=None)
        assert score == TRUST_SCORE_NEUTRAL

    def test_missing_components_fall_back_to_neutral_individually(self):
        score = calculate_trust_score(review_avg=5.0, payment_success_rate=None, completion_rate=None)
        assert score == round(0.5 * 5.0 + 0.3 * TRUST_SCORE_NEUTRAL + 0.2 * TRUST_SCORE_NEUTRAL, 2)

    def test_low_payment_success_rate_drags_score_down(self):
        good = calculate_trust_score(review_avg=5.0, payment_success_rate=1.0, completion_rate=1.0)
        bad = calculate_trust_score(review_avg=5.0, payment_success_rate=0.0, completion_rate=1.0)
        assert bad < good

    def test_low_completion_rate_drags_score_down(self):
        good = calculate_trust_score(review_avg=5.0, payment_success_rate=1.0, completion_rate=1.0)
        bad = calculate_trust_score(review_avg=5.0, payment_success_rate=1.0, completion_rate=0.0)
        assert bad < good


class TestDescribeTrustScore:
    def test_new_user_with_no_history(self):
        basis = describe_trust_score(review_avg=None, payment_success_rate=None, completion_rate=None, review_count=0)
        assert basis == "New user (no trust history yet)"

    def test_mentions_all_three_components_when_present(self):
        basis = describe_trust_score(
            review_avg=4.5, payment_success_rate=0.95, completion_rate=0.92, review_count=10
        )
        assert "highly rated" in basis.lower()
        assert "strong payment history" in basis.lower()
        assert "reliably completes orders" in basis.lower()

    def test_flags_inconsistent_payment_history(self):
        basis = describe_trust_score(
            review_avg=4.5, payment_success_rate=0.2, completion_rate=0.9, review_count=5
        )
        assert "inconsistent payment history" in basis.lower()

    def test_flags_frequent_cancellations(self):
        basis = describe_trust_score(
            review_avg=4.5, payment_success_rate=0.9, completion_rate=0.1, review_count=5
        )
        assert "often cancels orders" in basis.lower()
