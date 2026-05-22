"""
AidVocate Fraud Detection Service
FastAPI microservice for DPAD (Donation Pattern Anomaly Detection) and MTCS (Multi-factor Transaction Confidence Scoring)
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import uvicorn

from algorithms.dpad import DPADAnalyzer, DPADResult
from algorithms.mtcs import MTCSCalculator, MTCSResult

# Initialize FastAPI app
app = FastAPI(
    title="AidVocate Fraud Detection Service",
    description="DPAD and MTCS algorithms for donation fraud detection",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize analyzers
dpad_analyzer = DPADAnalyzer()
mtcs_calculator = MTCSCalculator()


# =============================================
# Request/Response Models
# =============================================

class DonorHistory(BaseModel):
    """Donor historical data"""
    account_age_days: int = Field(ge=0)
    total_donations: int = Field(ge=0)
    successful_donations: int = Field(ge=0)
    complaints_received: int = Field(ge=0)
    donations_last_hour: int = Field(ge=0)
    donations_last_day: int = Field(ge=0)
    unique_ngos_last_week: int = Field(ge=0)
    average_donation: float = Field(ge=0)
    kyc_verified: bool = False
    last_location: Optional[str] = None
    last_transaction_time: Optional[datetime] = None


class TransactionData(BaseModel):
    """Transaction details for analysis"""
    transaction_id: str
    donor_id: str
    ngo_id: str
    amount: float = Field(gt=0)
    payment_method: str
    timestamp: datetime = Field(default_factory=datetime.now)
    location: Optional[str] = None
    purpose: Optional[str] = None


class NGOData(BaseModel):
    """NGO information"""
    ngo_id: str
    verification_level: str = "PARTIAL"  # FULL, PARTIAL, PENDING
    bank_account: Optional[str] = None
    gcash_number: Optional[str] = None


class OracleData(BaseModel):
    """Oracle verification data"""
    oracle_agreement_count: int = Field(ge=0, default=2)
    primary_gateway_trust_score: float = Field(ge=0, le=1, default=0.9)
    has_cryptographic_receipt: bool = True
    bank_confirmed: bool = False


class DPADRequest(BaseModel):
    """Request model for DPAD analysis"""
    transaction: TransactionData
    donor_history: DonorHistory
    ngo_data: Optional[NGOData] = None


class MTCSRequest(BaseModel):
    """Request model for MTCS calculation"""
    transaction: TransactionData
    donor_history: DonorHistory
    ngo_data: NGOData
    oracle_data: OracleData
    dpad_risk_score: float = Field(ge=0, le=1)


class HVPRequest(BaseModel):
    """Request model for HVP verification strategy"""
    transaction: TransactionData
    donor_history: DonorHistory
    mtcs_confidence_score: float = Field(ge=0, le=1)


# =============================================
# API Endpoints
# =============================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "fraud-detection",
        "timestamp": datetime.now().isoformat()
    }


@app.post("/analyze", response_model=DPADResult)
async def analyze_donation(request: DPADRequest):
    """
    Analyze donation for fraud patterns using DPAD algorithm

    Returns risk score (0-1) and recommended action
    """
    try:
        result = dpad_analyzer.analyze(
            transaction=request.transaction.model_dump(),
            donor_history=request.donor_history.model_dump(),
            ngo_data=request.ngo_data.model_dump() if request.ngo_data else None
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/confidence", response_model=MTCSResult)
async def calculate_confidence(request: MTCSRequest):
    """
    Calculate transaction confidence score using MTCS algorithm

    Returns confidence score (0-1) and verification requirements
    """
    try:
        result = mtcs_calculator.calculate(
            transaction=request.transaction.model_dump(),
            donor_history=request.donor_history.model_dump(),
            ngo_data=request.ngo_data.model_dump(),
            oracle_data=request.oracle_data.model_dump(),
            dpad_risk_score=request.dpad_risk_score
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/verification-strategy")
async def get_verification_strategy(request: HVPRequest):
    """
    Determine verification strategy using HVP algorithm

    Returns verification level and requirements based on risk
    """
    try:
        amount = request.transaction.amount
        confidence = request.mtcs_confidence_score
        account_age = request.donor_history.account_age_days

        # Determine base tier by amount
        if amount < 500:
            base_tier = "LIGHTWEIGHT"
        elif amount < 5000:
            base_tier = "STANDARD"
        else:
            base_tier = "ENHANCED"

        # Adjust based on confidence
        if confidence < 0.5 and base_tier == "LIGHTWEIGHT":
            base_tier = "STANDARD"
        elif confidence < 0.3 and base_tier == "STANDARD":
            base_tier = "ENHANCED"

        # Adjust based on trust
        if account_age > 365 and confidence >= 0.8:
            if base_tier == "ENHANCED":
                base_tier = "STANDARD"
            elif base_tier == "STANDARD" and amount < 1000:
                base_tier = "LIGHTWEIGHT"

        # Build strategy
        strategies = {
            "LIGHTWEIGHT": {
                "name": "LIGHTWEIGHT",
                "oracles_required": 1,
                "blockchain_method": "BATCH",
                "delay_seconds": 0,
                "estimated_cost_php": round(amount * 0.025 + 0.20, 2)
            },
            "STANDARD": {
                "name": "STANDARD",
                "oracles_required": 2,
                "blockchain_method": "INDIVIDUAL",
                "delay_seconds": 0 if confidence >= 0.7 else 1800,
                "estimated_cost_php": round(amount * 0.025 + 2.00, 2)
            },
            "ENHANCED": {
                "name": "ENHANCED",
                "oracles_required": 3,
                "blockchain_method": "INDIVIDUAL",
                "delay_seconds": calculate_delay(confidence, amount),
                "additional_verification": ["2FA", "Photo ID"] if confidence < 0.6 else [],
                "estimated_cost_php": round(amount * 0.025 + 5.00, 2)
            }
        }

        return {
            "strategy": strategies[base_tier],
            "confidence_score": confidence,
            "amount": amount,
            "selected_tier": base_tier
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def calculate_delay(confidence: float, amount: float) -> int:
    """Calculate delay based on confidence and amount"""
    if confidence >= 0.9:
        return 0

    if amount < 10000:
        base_delay = 3600  # 1 hour
    elif amount < 50000:
        base_delay = 7200  # 2 hours
    else:
        base_delay = 86400  # 24 hours

    if confidence >= 0.7:
        multiplier = 0.5
    elif confidence >= 0.5:
        multiplier = 1.0
    else:
        multiplier = 2.0

    return int(base_delay * multiplier)


# =============================================
# Main
# =============================================

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
