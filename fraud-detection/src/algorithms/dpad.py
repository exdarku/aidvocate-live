"""
DPAD - Donation Pattern Anomaly Detection Algorithm
Purpose: Identify suspicious donation patterns for fraud prevention
"""

from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum


class RecommendedAction(str, Enum):
    APPROVE = "APPROVE"
    FLAG = "FLAG"
    REVIEW = "REVIEW"
    BLOCK = "BLOCK"


class DPADResult(BaseModel):
    """Result of DPAD analysis"""
    risk_score: float = Field(ge=0, le=1)
    flags: List[str] = []
    recommended_action: RecommendedAction
    details: Dict[str, Any] = {}


class DPADConfig:
    """Configuration parameters for DPAD"""
    # Velocity thresholds
    MAX_DONATIONS_PER_HOUR = 5
    MAX_DONATIONS_PER_DAY = 20

    # Amount thresholds
    REPORTING_THRESHOLD = 10000  # PHP 10,000
    THRESHOLD_MARGIN = 100  # PHP 100
    LARGE_DONATION = 5000

    # NGO switching
    MAX_UNIQUE_NGOS_PER_WEEK = 10

    # Risk thresholds
    BLOCK_THRESHOLD = 0.7
    REVIEW_THRESHOLD = 0.4
    FLAG_THRESHOLD = 0.2

    # Pattern weights
    ROUND_TRIPPING_WEIGHT = 0.30
    VELOCITY_WEIGHT = 0.20
    THRESHOLD_AVOIDANCE_WEIGHT = 0.25
    NEW_ACCOUNT_WEIGHT = 0.30
    TEMPORAL_WEIGHT = 0.15
    NGO_SWITCHING_WEIGHT = 0.20


class DPADAnalyzer:
    """
    DPAD Analyzer - Donation Pattern Anomaly Detection

    Analyzes donation transactions for suspicious patterns:
    - Round-tripping (donor = NGO)
    - Velocity anomaly (too many donations)
    - Threshold avoidance (amounts just below limits)
    - Temporal analysis (odd hours)
    - Beneficiary switching (rapid NGO changes)
    - New account risk
    """

    def __init__(self, config: Optional[DPADConfig] = None):
        self.config = config or DPADConfig()

    def analyze(
        self,
        transaction: Dict[str, Any],
        donor_history: Dict[str, Any],
        ngo_data: Optional[Dict[str, Any]] = None
    ) -> DPADResult:
        """
        Main DPAD analysis function

        Args:
            transaction: Current transaction details
            donor_history: Historical data for this donor
            ngo_data: NGO information (optional)

        Returns:
            DPADResult with risk score, flags, and recommended action
        """
        risk_score = 0.0
        flags: List[str] = []
        details: Dict[str, Any] = {}

        # ═══════════════════════════════════════════════════════════
        # PATTERN 1: Round-tripping Detection
        # ═══════════════════════════════════════════════════════════
        if ngo_data:
            round_trip_score, round_trip_flag = self._check_round_tripping(
                transaction, donor_history, ngo_data
            )
            risk_score += round_trip_score
            if round_trip_flag:
                flags.append(round_trip_flag)

        # ═══════════════════════════════════════════════════════════
        # PATTERN 2: Velocity Anomaly
        # ═══════════════════════════════════════════════════════════
        velocity_score, velocity_flags = self._check_velocity(donor_history)
        risk_score += velocity_score
        flags.extend(velocity_flags)
        details["velocity"] = donor_history.get("donations_last_hour", 0)

        # ═══════════════════════════════════════════════════════════
        # PATTERN 3: Amount Pattern Recognition (Threshold Avoidance)
        # ═══════════════════════════════════════════════════════════
        amount_score, amount_flag = self._check_amount_pattern(transaction)
        risk_score += amount_score
        if amount_flag:
            flags.append(amount_flag)

        # ═══════════════════════════════════════════════════════════
        # PATTERN 4: Temporal Analysis
        # ═══════════════════════════════════════════════════════════
        temporal_score, temporal_flag = self._check_temporal_pattern(transaction)
        risk_score += temporal_score
        if temporal_flag:
            flags.append(temporal_flag)

        # ═══════════════════════════════════════════════════════════
        # PATTERN 5: Beneficiary Switching
        # ═══════════════════════════════════════════════════════════
        switching_score, switching_flag = self._check_ngo_switching(donor_history)
        risk_score += switching_score
        if switching_flag:
            flags.append(switching_flag)

        # ═══════════════════════════════════════════════════════════
        # PATTERN 6: New Account Risk
        # ═══════════════════════════════════════════════════════════
        new_account_score, new_account_flag = self._check_new_account_risk(
            donor_history, transaction
        )
        risk_score += new_account_score
        if new_account_flag:
            flags.append(new_account_flag)
        details["account_age"] = donor_history.get("account_age_days", 0)

        # ═══════════════════════════════════════════════════════════
        # FINAL RISK ASSESSMENT
        # ═══════════════════════════════════════════════════════════

        # Normalize risk score to [0, 1]
        risk_score = min(risk_score, 1.0)
        details["ml_score"] = 0.0  # Placeholder for ML model

        # Determine recommended action
        if risk_score >= self.config.BLOCK_THRESHOLD:
            action = RecommendedAction.BLOCK
        elif risk_score >= self.config.REVIEW_THRESHOLD:
            action = RecommendedAction.REVIEW
        elif risk_score >= self.config.FLAG_THRESHOLD:
            action = RecommendedAction.FLAG
        else:
            action = RecommendedAction.APPROVE

        return DPADResult(
            risk_score=round(risk_score, 4),
            flags=flags,
            recommended_action=action,
            details=details
        )

    def _check_round_tripping(
        self,
        transaction: Dict[str, Any],
        donor_history: Dict[str, Any],
        ngo_data: Dict[str, Any]
    ) -> tuple[float, Optional[str]]:
        """Check if donor and NGO might be the same entity"""
        # In production, this would check:
        # - Same bank account
        # - Same IP address history
        # - Same phone number
        # For now, simple placeholder
        return 0.0, None

    def _check_velocity(
        self,
        donor_history: Dict[str, Any]
    ) -> tuple[float, List[str]]:
        """Check for unusually high frequency of donations"""
        score = 0.0
        flags = []

        donations_last_hour = donor_history.get("donations_last_hour", 0)
        donations_last_day = donor_history.get("donations_last_day", 0)

        if donations_last_hour > self.config.MAX_DONATIONS_PER_HOUR:
            score += 0.20
            flags.append(f"HIGH_VELOCITY: {donations_last_hour} donations/hour")

        if donations_last_day > self.config.MAX_DONATIONS_PER_DAY:
            score += 0.15
            flags.append(f"DAILY_VELOCITY: {donations_last_day} donations/day")

        return score, flags

    def _check_amount_pattern(
        self,
        transaction: Dict[str, Any]
    ) -> tuple[float, Optional[str]]:
        """Check for threshold avoidance patterns"""
        amount = transaction.get("amount", 0)

        # Check if amount is suspiciously just below reporting threshold
        threshold = self.config.REPORTING_THRESHOLD
        margin = self.config.THRESHOLD_MARGIN

        if (threshold - margin) < amount < threshold:
            return (
                self.config.THRESHOLD_AVOIDANCE_WEIGHT,
                f"THRESHOLD_AVOIDANCE: PHP {amount} (just below PHP {threshold})"
            )

        return 0.0, None

    def _check_temporal_pattern(
        self,
        transaction: Dict[str, Any]
    ) -> tuple[float, Optional[str]]:
        """Check for unusual timing patterns"""
        timestamp = transaction.get("timestamp")

        if isinstance(timestamp, str):
            timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))

        if timestamp:
            hour = timestamp.hour
            amount = transaction.get("amount", 0)

            # Large donations at odd hours (2 AM - 5 AM)
            if 2 <= hour <= 5 and amount > self.config.LARGE_DONATION:
                return (
                    self.config.TEMPORAL_WEIGHT,
                    f"ODD_TIMING: Large donation at {hour}:00"
                )

        return 0.0, None

    def _check_ngo_switching(
        self,
        donor_history: Dict[str, Any]
    ) -> tuple[float, Optional[str]]:
        """Check for rapid NGO switching pattern"""
        unique_ngos = donor_history.get("unique_ngos_last_week", 0)

        if unique_ngos > self.config.MAX_UNIQUE_NGOS_PER_WEEK:
            return (
                self.config.NGO_SWITCHING_WEIGHT,
                f"RAPID_NGO_SWITCHING: {unique_ngos} NGOs in 7 days"
            )

        return 0.0, None

    def _check_new_account_risk(
        self,
        donor_history: Dict[str, Any],
        transaction: Dict[str, Any]
    ) -> tuple[float, Optional[str]]:
        """Check for new account with high-value donations"""
        account_age = donor_history.get("account_age_days", 0)
        amount = transaction.get("amount", 0)

        if account_age < 1 and amount > 5000:
            return (
                0.40,
                f"BRAND_NEW_ACCOUNT: Less than 24 hours old, amount PHP {amount}"
            )

        if account_age < 7 and amount > 10000:
            return (
                self.config.NEW_ACCOUNT_WEIGHT,
                f"NEW_ACCOUNT_HIGH_VALUE: Account age {account_age} days, amount PHP {amount}"
            )

        return 0.0, None
