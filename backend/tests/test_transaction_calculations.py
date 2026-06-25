import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.utils import calculate_subtotal, calculate_platform_fee, calculate_total


class TestSubtotal:
    def test_basic(self):
        assert calculate_subtotal(10.0, 5.0) == 50.0

    def test_fractional_quantity(self):
        assert calculate_subtotal(12.5, 0.6) == 7.5

    def test_zero_quantity(self):
        assert calculate_subtotal(10.0, 0.0) == 0.0

    def test_zero_price(self):
        assert calculate_subtotal(0.0, 100.0) == 0.0


class TestPlatformFee:
    def test_2_percent(self):
        assert calculate_platform_fee(100.0) == 2.0

    def test_rounds_to_2_decimals(self):
        assert calculate_platform_fee(33.33) == 0.67

    def test_zero(self):
        assert calculate_platform_fee(0.0) == 0.0


class TestTotal:
    def test_includes_fee(self):
        assert calculate_total(100.0, 1.0) == 102.0

    def test_rounds_correctly(self):
        assert calculate_total(12.5, 5.0) == 63.75

    def test_zero_quantity(self):
        assert calculate_total(10.0, 0.0) == 0.0
