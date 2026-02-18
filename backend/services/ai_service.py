"""
AI Service - Mock and real LLM integration
Supports: mock, openai, bedrock
"""
import os
from typing import Dict, Any, List

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "mock").lower()


async def get_ai_analysis(claims_summary: Dict[str, Any], policy_number: str) -> Dict[str, Any]:
    """
    Analyze claims data and return risk assessment with guideline citation.
    Uses mock logic by default, can switch to OpenAI or Bedrock.
    """
    if LLM_PROVIDER == "openai":
        return await _openai_analysis(claims_summary, policy_number)
    elif LLM_PROVIDER == "gemini":
        return await _gemini_analysis(claims_summary, policy_number)
    elif LLM_PROVIDER == "bedrock":
        return await _bedrock_analysis(claims_summary, policy_number)
    else:
        return await _mock_analysis(claims_summary, policy_number)


async def _mock_analysis(claims_summary: Dict[str, Any], policy_number: str) -> Dict[str, Any]:
    """
    Rule-based mock analysis - deterministic for demo reliability
    """
    claim_count = claims_summary.get("claim_count", 0)
    total_amount = claims_summary.get("total_amount", 0)
    max_claim = claims_summary.get("max_claim", 0)
    
    # Rule 1: High severity threshold
    if max_claim >= 100000:
        return {
            "recommendation": "REFER TO SENIOR UNDERWRITER",
            "risk_level": "refer",
            "reason": f"Single claim of ${max_claim:,.2f} exceeds $100,000 severity threshold",
            "guideline_section": "Section 4.3.2",
            "guideline_text": "Claims exceeding $100,000 require senior underwriter review prior to renewal."
        }
    
    # Rule 2: High frequency
    if claim_count >= 5:
        return {
            "recommendation": "REVIEW REQUIRED - HIGH FREQUENCY",
            "risk_level": "high",
            "reason": f"{claim_count} claims in review period exceeds frequency threshold of 5",
            "guideline_section": "Section 3.1.1",
            "guideline_text": "Accounts with 5 or more claims annually require enhanced review and loss control assessment."
        }
    
    # Rule 3: High total amount
    if total_amount >= 200000:
        return {
            "recommendation": "REFER TO SENIOR UNDERWRITER",
            "risk_level": "refer",
            "reason": f"Total claims amount of ${total_amount:,.2f} exceeds $200,000 threshold",
            "guideline_section": "Section 4.2.1",
            "guideline_text": "Aggregate claims exceeding $200,000 require senior underwriter approval."
        }
    
    # Rule 4: Medium risk
    if claim_count >= 3 or total_amount >= 75000:
        return {
            "recommendation": "PROCEED WITH CAUTION",
            "risk_level": "medium",
            "reason": f"Moderate claims activity ({claim_count} claims, ${total_amount:,.2f} total)",
            "guideline_section": "Section 2.3.4",
            "guideline_text": "Accounts with moderate claims activity should be priced with appropriate experience modification."
        }
    
    # Default: Low risk
    return {
        "recommendation": "APPROVE - STANDARD TERMS",
        "risk_level": "low",
        "reason": f"Claims history within acceptable parameters ({claim_count} claims, ${total_amount:,.2f} total)",
        "guideline_section": "Section 1.1.1",
        "guideline_text": "Standard underwriting applies for accounts meeting minimum eligibility criteria."
    }


async def _openai_analysis(claims_summary: Dict[str, Any], policy_number: str) -> Dict[str, Any]:
    """
    OpenAI-powered analysis (for local development)
    """
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI()
        
        prompt = f"""You are an insurance underwriting assistant. Analyze the following claims data and provide a risk assessment.

Claims Summary for Policy {policy_number}:
- Total Claims: {claims_summary.get('claim_count', 0)}
- Total Amount: ${claims_summary.get('total_amount', 0):,.2f}
- Average Claim: ${claims_summary.get('avg_amount', 0):,.2f}
- Largest Claim: ${claims_summary.get('max_claim', 0):,.2f}

Provide your response in this exact JSON format:
{{
    "recommendation": "APPROVE/REVIEW REQUIRED/REFER TO SENIOR UNDERWRITER",
    "risk_level": "low/medium/high/refer",
    "reason": "Brief explanation",
    "guideline_section": "Section X.X.X",
    "guideline_text": "Relevant underwriting guideline"
}}"""

        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        
        import json
        return json.loads(response.choices[0].message.content)
        
    except Exception as e:
        print(f"OpenAI error: {e}")
        return await _mock_analysis(claims_summary, policy_number)


async def _gemini_analysis(claims_summary: Dict[str, Any], policy_number: str) -> Dict[str, Any]:
    """
    Gemini-powered analysis (free tier with API key)
    """
    api_key = os.getenv("GOOGLE_API_KEY", "")
    if not api_key or api_key == "your-google-api-key-here":
        return await _mock_analysis(claims_summary, policy_number)

    try:
        import json
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        model_name = os.getenv("GEMINI_MODEL", "").strip()
        model_candidates: List[str] = [
            model_name,
            "gemini-2.0-flash",
            "gemini-2.5-flash-lite",
            "gemini-2.5-flash",
        ]
        model_candidates = [m for m in model_candidates if m]

        prompt = f"""You are an insurance underwriting assistant. Analyze the following claims data and provide a risk assessment.

Claims Summary for Policy {policy_number}:
- Total Claims: {claims_summary.get('claim_count', 0)}
- Total Amount: ${claims_summary.get('total_amount', 0):,.2f}
- Average Claim: ${claims_summary.get('avg_amount', 0):,.2f}
- Largest Claim: ${claims_summary.get('max_claim', 0):,.2f}

Provide your response in this exact JSON format:
{{
    "recommendation": "APPROVE/REVIEW REQUIRED/REFER TO SENIOR UNDERWRITER",
    "risk_level": "low/medium/high/refer",
    "reason": "Brief explanation",
    "guideline_section": "Section X.X.X",
    "guideline_text": "Relevant underwriting guideline"
}}"""

        last_error: Exception | None = None
        for candidate in model_candidates:
            try:
                model = genai.GenerativeModel(candidate)
                response = model.generate_content(
                    prompt,
                    generation_config={
                        "temperature": 0.2,
                        "response_mime_type": "application/json",
                    },
                )

                text = response.text or ""
                return json.loads(text)
            except Exception as e:
                last_error = e

        if last_error:
            raise last_error
    except Exception as e:
        print(f"Gemini error: {e}")
        return await _mock_analysis(claims_summary, policy_number)


async def _bedrock_analysis(claims_summary: Dict[str, Any], policy_number: str) -> Dict[str, Any]:
    """
    AWS Bedrock-powered analysis (for production)
    """
    try:
        import boto3
        import json
        
        client = boto3.client('bedrock-runtime', region_name=os.getenv('AWS_REGION', 'us-east-1'))
        
        prompt = f"""You are an insurance underwriting assistant. Analyze the following claims data:

Policy: {policy_number}
Claims: {claims_summary.get('claim_count', 0)}
Total: ${claims_summary.get('total_amount', 0):,.2f}
Largest: ${claims_summary.get('max_claim', 0):,.2f}

Respond with JSON containing: recommendation, risk_level, reason, guideline_section, guideline_text"""

        response = client.invoke_model(
            modelId="anthropic.claude-3-haiku-20240307-v1:0",
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 500,
                "messages": [{"role": "user", "content": prompt}]
            })
        )
        
        result = json.loads(response['body'].read())
        return json.loads(result['content'][0]['text'])
        
    except Exception as e:
        print(f"Bedrock error: {e}")
        return await _mock_analysis(claims_summary, policy_number)
