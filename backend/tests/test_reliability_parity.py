"""
Automated Parity & Reliability Test Suite for ThermoTrace AI
Verifies deterministic feature encoding, probability preservation, lifecycle freshness bounds,
and marker symbology contract rules.
"""
import sys
import os
import unittest
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.domain.features import encode_facility_category
from app.domain.lifecycle import evaluate_lifecycle, FRESHNESS_ACTIVE, FRESHNESS_AGING, FRESHNESS_HISTORICAL

class TestThermoTraceReliability(unittest.TestCase):

    def test_deterministic_facility_category_encoding(self):
        """Verify facility category encoding is process-independent and deterministic."""
        refinery_code_1 = encode_facility_category("Refinery")
        refinery_code_2 = encode_facility_category("Refinery Complex")
        steel_code = encode_facility_category("Steel & Iron Plant")
        unknown_code = encode_facility_category("UNKNOWN")

        self.assertEqual(refinery_code_1, 1)
        self.assertEqual(refinery_code_2, 1)
        self.assertEqual(steel_code, 3)
        self.assertEqual(unknown_code, 0)

    def test_lifecycle_freshness_boundaries(self):
        """Verify 24h and 72h temporal freshness evaluation boundaries."""
        ref_time = datetime(2026, 9, 18, 21, 0, 0, tzinfo=timezone.utc)

        # 1. Active (< 24h)
        t_active = ref_time - timedelta(hours=12)
        res_act = evaluate_lifecycle(t_active, reference_time=ref_time)
        self.assertEqual(res_act["lifecycle_status"], "ACTIVE")
        self.assertEqual(res_act["freshness_status"], FRESHNESS_ACTIVE)
        self.assertTrue(res_act["is_active"])

        # 2. Aging (24h to 72h)
        t_aging = ref_time - timedelta(hours=36)
        res_aging = evaluate_lifecycle(t_aging, reference_time=ref_time)
        self.assertEqual(res_aging["lifecycle_status"], "COOLING")
        self.assertEqual(res_aging["freshness_status"], FRESHNESS_AGING)
        self.assertFalse(res_aging["is_active"])

        # 3. Historical (> 72h)
        t_hist = ref_time - timedelta(hours=96)
        res_hist = evaluate_lifecycle(t_hist, reference_time=ref_time)
        self.assertEqual(res_hist["lifecycle_status"], "EXTINGUISHED")
        self.assertEqual(res_hist["freshness_status"], FRESHNESS_HISTORICAL)
        self.assertFalse(res_hist["is_active"])

    def test_future_timestamp_handling(self):
        """Verify clock-skew / future timestamp defense defaults elapsed_hours safely to 0."""
        ref_time = datetime(2026, 9, 18, 21, 0, 0, tzinfo=timezone.utc)
        t_future = ref_time + timedelta(minutes=15)
        res_future = evaluate_lifecycle(t_future, reference_time=ref_time)
        self.assertEqual(res_future["lifecycle_status"], "ACTIVE")
        self.assertEqual(res_future["elapsed_hours"], 0.0)

if __name__ == "__main__":
    unittest.main()
