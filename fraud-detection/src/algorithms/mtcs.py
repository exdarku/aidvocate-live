"""
MTCS - Multi-factor Transaction Confidence Scoring Algorithm
Purpose: Generate confidence score for graduated response decision-making
"""

from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field
from datetime import datetime


class MTCSBreakdown(BaseModel):
    """Breakdown of individual factor scores"""
    payment: float = Field(ge=0, le=1)
    reputation: float = Field(ge=0, le=1)
    pattern: float = Field(ge=0, le=1)
    oracle: float = Field(ge=0, le=1)
    context: float = Field(ge=0, le=1)


class MTCSResult(BaseModel):
    """Result of MTCS calculation"""
    confidence_score: float = Field(ge=0, le=1)
    breakdown: MTCSBreakdown
    action: str
    verification_level: str
    delay_seconds: Optional[int] = None
    explanation: str
    requirements: Optional[List[str]] = None


class MTCSConfig:
    """Configuration for MTCS weights"""
    # Factor weights (must sum to 1.0)
    PAYMENT_WEIGHT = 0.30
    REPUTATION_WEIGHT = 0.25
    PATTERN_WEIGHT = 0.20
    ORACLE_WEIGHT = 0.15
    CONTEXT_WEIGHT = 0.10

    # Thresholds for actions
    APPROVE_IMMEDIATELY_THRESHOLD = 0.9
    APPROVE_WITH_MONITORING_THRESHOLD = 0.7
    APPROVE_WITH_DELAY_THRESHOLD = 0.5
    ADDITIONAL_VERIFICATION_THRESHOLD = 0.3


class MTCSCalculator:
    """
    MTCS Calculator - Multi-factor Transaction Confidence Scoring

    Calculates confidence score based on:
    - Payment verification (30%)
    - Donor reputation (25%)
    - Pattern score (20%)
    - Oracle trust (15%)
    - Context (10%)
    """

    def __init__(self, config: Optional[MTCSConfig] = None):
        self.config = config or MTCSConfig()

    def calculate(
        self,
        transaction: Dict[str, Any],
        donor_history: Dict[str, Any],
        ngo_data: Dict[str, Any],
        oracle_data: Dict[str, Any],
        dpad_risk_score: float
    ) -> MTCSResult:
        """
        Calculate multi-factor confidence score

        Args:
            transaction: Current transaction details
            donor_history: Donor historical data and reputation
            ngo_data: NGO verification status and history
            oracle_data: Payment verification source information
            dpad_risk_score: Output from DPAD fraud detection (0-1)

        Returns:
            MTCSResult with confidence score and recommendations
        """

        # ═══════════════════════════════════════════════════════════
        # FACTOR 1: Payment Verification Score (30%)
        # ═══════════════════════════════════════════════════════════
        payment_score = self._calculate_payment_score(oracle_data)

        # ═══════════════════════════════════════════════════════════
        # FACTOR 2: Donor Reputation Score (25%)
        # ═══════════════════════════════════════════════════════════
        reputation_score = self._calculate_reputation_score(donor_history)

        # ═══════════════════════════════════════════════════════════
        # FACTOR 3: Pattern Score (20%)
        # ═══════════════════════════════════════════════════════════
        pattern_score = self._calculate_pattern_score(dpad_risk_score)

        # ═══════════════════════════════════════════════════════════
        # FACTOR 4: Oracle Trust Score (15%)
        # ═══════════════════════════════════════════════════════════
        oracle_score = self._calculate_oracle_score(oracle_data)

        # ═══════════════════════════════════════════════════════════
        # FACTOR 5: Contextual Factors (10%)
        # ═══════════════════════════════════════════════════════════
        context_score = self._calculate_context_score(
            transaction, donor_history, ngo_data
        )

        # ═══════════════════════════════════════════════════════════
        # WEIGHTED COMBINATION
        # ═══════════════════════════════════════════════════════════
        confidence_score = (
            self.config.PAYMENT_WEIGHT * payment_score +
            self.config.REPUTATION_WEIGHT * reputation_score +
            self.config.PATTERN_WEIGHT * pattern_score +
            self.config.ORACLE_WEIGHT * oracle_score +
            self.config.CONTEXT_WEIGHT * context_score
        )

        # Ensure in valid range
        confidence_score = max(0.0, min(1.0, confidence_score))

        # ═══════════════════════════════════════════════════════════
        # GRADUATED RESPONSE DECISION
        # ═══════════════════════════════════════════════════════════
        action, verification_level, delay, explanation, requirements = \
            self._determine_action(confidence_score)

        return MTCSResult(
            confidence_score=round(confidence_score, 4),
            breakdown=MTCSBreakdown(
                payment=round(payment_score, 4),
                reputation=round(reputation_score, 4),
                pattern=round(pattern_score, 4),
                oracle=round(oracle_score, 4),
                context=round(context_score, 4)
            ),
            action=action,
            verification_level=verification_level,
            delay_seconds=delay,
            explanation=explanation,
            requirements=requirements
        )

    def _calculate_payment_score(self, oracle_data: Dict[str, Any]) -> float:
        """Calculate payment verification score"""
        score = 0.0

        # Multi-oracle agreement
        oracle_agreement = oracle_data.get("oracle_agreement_count", 1)
        if oracle_agreement >= 3:
            score += 0.40
        elif oracle_agreement >= 2:
            score += 0.30
        elif oracle_agreement == 1:
            score += 0.15

        # Payment gateway reliability
        gateway_trust = oracle_data.get("primary_gateway_trust_score", 0.5)
        score += gateway_trust * 0.30

        # Cryptographic receipt verification
        if oracle_data.get("has_cryptographic_receipt", False):
            score += 0.20

        # Bank confirmation
        if oracle_data.get("bank_confirmed", False):
            score += 0.10

        return min(score, 1.0)

    def _calculate_reputation_score(self, donor_history: Dict[str, Any]) -> float:
        """Calculate donor reputation score"""
        score = 0.0

        # Account age
        account_age = donor_history.get("account_age_days", 0)
        if account_age >= 365:
            age_score = 1.0
        elif account_age >= 180:
            age_score = 0.8
        elif account_age >= 90:
            age_score = 0.6
        elif account_age >= 30:
            age_score = 0.4
        elif account_age >= 7:
            age_score = 0.2
        else:
            age_score = 0.0
        score += age_score * 0.40

        # Donation success rate
        total_donations = donor_history.get("total_donations", 0)
        successful_donations = donor_history.get("successful_donations", 0)
        if total_donations > 0:
            success_rate = successful_donations / total_donations
            score += success_rate * 0.30

        # Complaint ratio
        complaints = donor_history.get("complaints_received", 0)
        if total_donations > 0:
            complaint_rate = complaints / total_donations
            complaint_score = 1.0 - min(complaint_rate * 2, 1.0)
            score += complaint_score * 0.20

        # KYC verification
        if donor_history.get("kyc_verified", False):
            score += 0.10

        return min(score, 1.0)

    def _calculate_pattern_score(self, dpad_risk_score: float) -> float:
        """Calculate pattern score (inverse of DPAD risk)"""
        return 1.0 - dpad_risk_score

    def _calculate_oracle_score(self, oracle_data: Dict[str, Any]) -> float:
        """Calculate oracle trust score"""
        return oracle_data.get("primary_gateway_trust_score", 0.5)

    def _calculate_context_score(
        self,
        transaction: Dict[str, Any],
        donor_history: Dict[str, Any],
        ngo_data: Dict[str, Any]
    ) -> float:
        """Calculate contextual score"""
        score = 0.0

        # Time appropriateness
        timestamp = transaction.get("timestamp")
        if isinstance(timestamp, str):
            timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        if timestamp:
            hour = timestamp.hour
            if 8 <= hour <= 20:
                time_score = 1.0
            elif 6 <= hour <= 22:
                time_score = 0.7
            else:
                time_score = 0.3
            score += time_score * 0.40

        # Amount reasonableness
        amount = transaction.get("amount", 0)
        avg_donation = donor_history.get("average_donation", 0)
        if avg_donation > 0:
            ratio = amount / avg_donation
            if 0.5 <= ratio <= 2.0:
                amount_score = 1.0
            elif 0.2 <= ratio <= 5.0:
                amount_score = 0.6
            else:
                amount_score = 0.2
        else:
            amount_score = 0.5
        score += amount_score * 0.30

        # NGO verification status
        verification_level = ngo_data.get("verification_level", "PENDING")
        if verification_level == "FULL":
            ngo_score = 1.0
        elif verification_level == "PARTIAL":
            ngo_score = 0.7
        else:
            ngo_score = 0.3
        score += ngo_score * 0.30

        return min(score, 1.0)

    def _determine_action(
        self,
        confidence_score: float
    ) -> tuple[str, str, Optional[int], str, Optional[List[str]]]:
        """Determine action based on confidence score"""

        if confidence_score >= self.config.APPROVE_IMMEDIATELY_THRESHOLD:
            return (
                "APPROVE_IMMEDIATELY",
                "STANDARD",
                None,
                "High confidence - immediate approval",
                None
            )

        elif confidence_score >= self.config.APPROVE_WITH_MONITORING_THRESHOLD:
            return (
                "APPROVE_WITH_MONITORING",
                "ENHANCED_LOGGING",
                None,
                "Good confidence - approve with enhanced monitoring",
                None
            )

        elif confidence_score >= self.config.APPROVE_WITH_DELAY_THRESHOLD:
            return (
                "APPROVE_WITH_DELAY",
                "FULL_AUDIT",
                3600,  # 1 hour
                "Moderate confidence - 1-hour holding period",
                None
            )

        elif confidence_score >= self.config.ADDITIONAL_VERIFICATION_THRESHOLD:
            return (
                "REQUEST_ADDITIONAL_VERIFICATION",
                "2FA_REQUIRED",
                None,
                "Low confidence - require additional verification",
                ["2FA", "Phone verification"]
            )

        else:
            return (
                "REJECT",
                "MANUAL_REVIEW",
                None,
                "Very low confidence - manual review required",
                ["Manual review", "Admin approval"]
            )
