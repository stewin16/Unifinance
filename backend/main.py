import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS
import io
import re
import requests 
import json
import numpy as np


app = Flask(__name__)
CORS(app)


GOOGLE_API_KEY = "AIzaSyBkv1dXN3-JALMDtEPiyEp4-tEkQx6-ogQ"


def standardize_column_names(df):
    """
    Intelligently renames columns to a standard format based on common synonyms.
    This makes the app compatible with various real-world bank statement formats.
    """
    column_map = {
        'description': ['description', 'narration', 'particulars', 'transaction details'],
        'debit': ['debit', 'withdrawal', 'dr.', 'withdrawals', 'withdrawal amt.'],
        'credit': ['credit', 'deposit', 'cr.', 'deposits', 'deposit amt.']
    }

    new_columns = {}
    for col in df.columns:
        col_lower = col.strip().lower()
        for standard_name, synonyms in column_map.items():
            if col_lower in synonyms:
                new_columns[col] = standard_name
                break
    df.rename(columns=new_columns, inplace=True)
    return df




def categorize_transactions(df):
   
    categories = {
        'Income': ['salary', 'credit-techsolutions', 'freelance income', 'salary credit'],
        'Investments (80C)': ['sip', 'ppf', 'lic premium', 'mutual fund', 'zerodha'],
        'Medical (80D)': ['lic health', 'max bupa', 'star health', 'apollo munich', 'medical insurance', 'health insurance'],
        'Donations (80G)': ['donation', 'pm cares', 'giveindia'],
        'Rent': ['rent', 'nobroker'],
        'EMI & Loans': ['emi', 'loan', 'credit card', 'home loan'],
        'Food & Groceries': ['zomato', 'swiggy', 'blinkit', 'zepto', 'groceries'],
        'Shopping': ['amazon', 'flipkart', 'myntra', 'zara'],
        'Utilities': ['electricity', 'water bill', 'gas bill', 'phone bill'],
        'Other': ['upi', 'atm withdrawal', 'transfer']
    }
  
    df['description'] = df['description'].fillna('N/A')
    df['description_lower'] = df['description'].str.lower()

    def get_category(description):
       
        if not isinstance(description, str):
            return 'Other'
        for category, keywords in categories.items():
            for keyword in keywords:
                if keyword in description:
                    return category
        return 'Other'
   
    df['category'] = df['description_lower'].apply(get_category)
    return df


def get_fallback_recommendations(financial_summary):
    """
    Generates rule-based recommendations if the live AI service fails.
    """
    tax_recs = []
    cibil_recs = []

   
    if financial_summary['deductions']['80C'] < 150000:
        tax_recs.append("You have not fully utilized your Section 80C limit. Consider investing more in PPF, ELSS, or LIC to save tax.")
    else:
        tax_recs.append("You have successfully utilized your Section 80C limit. Explore other tax-saving options like NPS under Section 80CCD(1B).")

    tax_recs.append("Review your expenses to identify any other potential deductions, such as health insurance premiums (Section 80D) or donations (Section 80G).")

  
    if financial_summary['cibil']['utilization'] > 0.3:
        cibil_recs.append(f"Your credit utilization is at {financial_summary['cibil']['utilization']:.0%}, which is high. Try to keep it below 30% to improve your CIBIL score.")
    else:
        cibil_recs.append(f"Your credit utilization is healthy at {financial_summary['cibil']['utilization']:.0%}. Continue to maintain this to keep your score high.")

    cibil_recs.append("Always pay your credit card bills and loan EMIs on time. Timely payments have the biggest positive impact on your score.")

    return {
        "tax_recommendations": tax_recs,
        "cibil_recommendations": cibil_recs
    }


def get_dynamic_ai_recommendations(financial_summary):
    if not GOOGLE_API_KEY or GOOGLE_API_KEY == "REPLACE_WITH_YOUR_GOOGLE_AI_API_KEY":
        print("Warning: GOOGLE_API_KEY not configured. Using fallback recommendations.")
        return get_fallback_recommendations(financial_summary)

    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key={GOOGLE_API_KEY}"

    prompt = f"""
    You are an expert Indian financial advisor for FY 2024-25.
    Analyze the following financial summary and provide two separate lists of concise, actionable recommendations.

    User's Financial Summary:
    - Gross Annual Income: {financial_summary['income']:,.0f} INR
    - Deductions Claimed (80C): {financial_summary['deductions']['80C']:,.0f} INR
    - CIBIL Score: {financial_summary['cibil']['score']}
    - Credit Utilization: {financial_summary['cibil']['utilization']:.0%}

    Based on this, generate:
    1.  Tax Saving Opportunities: Legal ways to reduce tax liability under the Old Regime.
    2.  CIBIL Score Improvement: Steps to improve or maintain their credit score.

    Return the response as a valid JSON object with two keys: "tax_recommendations" and "cibil_recommendations". Each key must hold a list of strings.
    Example: {{"tax_recommendations": ["Invest in ELSS funds."], "cibil_recommendations": ["Keep credit utilization below 30%."]}}
    """

    payload = {
        "contents": [{"parts": [{"text": prompt}]}]
    }

    try:
        response = requests.post(api_url, json=payload, timeout=10)
        response.raise_for_status()
        result = response.json()

        text_content = result.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '{}')
        cleaned_response = text_content.strip().replace("json", "").replace("```", "")
        return json.loads(cleaned_response)

    except Exception as e:
       
        print(f"Live AI call failed: {e}. Using fallback recommendations.")
        return get_fallback_recommendations(financial_summary)


# ACCURATE TAX COMPUTATION ENGINE (FY 2024-25 / AY 2025-26)
STANDARD_DEDUCTION = 50000
LIMIT_80C = 150000
LIMIT_80D = 25000
LIMIT_24B = 200000
OLD_REGIME_SLABS = [{'from': 0, 'to': 250000, 'rate': 0.00}, {'from': 250001, 'to': 500000, 'rate': 0.05}, {'from': 500001, 'to': 1000000, 'rate': 0.20}, {'from': 1000001, 'to': float('inf'), 'rate': 0.30}]
NEW_REGIME_SLABS = [{'from': 0, 'to': 300000, 'rate': 0.00}, {'from': 300001, 'to': 600000, 'rate': 0.05}, {'from': 600001, 'to': 900000, 'rate': 0.10}, {'from': 900001, 'to': 1200000, 'rate': 0.15}, {'from': 1200001, 'to': 1500000, 'rate': 0.20}, {'from': 1500001, 'to': float('inf'), 'rate': 0.30}]
CESS_RATE = 0.04

def calculate_tax(taxable_income, slabs):
    tax = 0
    remaining_income = taxable_income
    sorted_slabs = sorted(slabs, key=lambda x: x['from'])

    for i in range(len(sorted_slabs)):
        slab = sorted_slabs[i]

        if taxable_income <= slab['from']:
            break

        taxable_in_slab = 0
        if slab['to'] == float('inf'):
            taxable_in_slab = taxable_income - slab['from']
        else:
            taxable_in_slab = min(taxable_income, slab['to']) - slab['from']

        tax += taxable_in_slab * slab['rate']

    return tax

def calculate_final_tax(gross_income, slabs, deductions=None):
    taxable_income = gross_income
    if slabs == NEW_REGIME_SLABS:
        taxable_income -= STANDARD_DEDUCTION
    if deductions and slabs == OLD_REGIME_SLABS:
        taxable_income -= STANDARD_DEDUCTION
        for section, amount in deductions.items():
            taxable_income -= amount

    taxable_income = max(0, taxable_income)

    rebate = 0
    if slabs == OLD_REGIME_SLABS and taxable_income <= 500000: rebate = 12500
    if slabs == NEW_REGIME_SLABS and taxable_income <= 700000: rebate = 25000

    base_tax = calculate_tax(taxable_income, slabs)
    tax_after_rebate = max(0, base_tax - rebate)
    cess = tax_after_rebate * CESS_RATE
    total_tax = tax_after_rebate + cess

    return total_tax, taxable_income


@app.route('/upload', methods=['POST'])
def upload_file():
    if 'statements' not in request.files:
        return jsonify({"error": "No file part"}), 400
    files = request.files.getlist('statements')

    try:
        all_dfs = []
        for file in files:
            content = file.read().decode('utf-8')
            df = pd.read_csv(io.StringIO(content))

            df = standardize_column_names(df)

            if 'description' not in df.columns:
                return jsonify({"error": f"CSV '{file.filename}' must have a transaction description column (e.g., 'Description', 'Narration')."}), 400

            if 'credit' not in df.columns: df['credit'] = 0
            if 'debit' not in df.columns: df['debit'] = 0

            for col in ['credit', 'debit']:
                if col in df.columns:
                    df[col] = df[col].astype(str).str.replace(r'[^\d.]', '', regex=True)
                    df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

            all_dfs.append(df)

        if not all_dfs: return jsonify({"error": "No valid CSV files processed"}), 400

        master_df = pd.concat(all_dfs, ignore_index=True)
        categorized_df = categorize_transactions(master_df)

        total_income = categorized_df[categorized_df['category'] == 'Income']['credit'].sum() * 12

        deductions = {
            '80C': min(categorized_df[categorized_df['category'] == 'Investments (80C)']['debit'].sum() * 12, LIMIT_80C),
            '80D': min(categorized_df[categorized_df['category'] == 'Medical (80D)']['debit'].sum() * 12, LIMIT_80D),
            '80G': categorized_df[categorized_df['category'] == 'Donations (80G)']['debit'].sum() * 12,
            '24b': min(categorized_df[categorized_df['description_lower'].str.contains('home loan', na=False)]['debit'].sum() * 0.4 * 12, LIMIT_24B)
        }

        old_tax_payable, old_taxable_income = calculate_final_tax(total_income, OLD_REGIME_SLABS, deductions)
        new_tax_payable, new_taxable_income = calculate_final_tax(total_income, NEW_REGIME_SLABS)
        recommended_regime = 'old' if old_tax_payable < new_tax_payable else 'new'

        credit_payments = categorized_df[categorized_df['category'] == 'EMI & Loans']['debit'].sum()
        total_debits = categorized_df['debit'].sum()
        credit_utilization = credit_payments / total_debits if total_debits > 0 else 0
        cibil_score = int(750 + (25 if credit_utilization < 0.1 else 0) - (50 if credit_utilization > 0.4 else 0))

        financial_summary_for_ai = {
            "income": total_income,
            "deductions": deductions,
            "cibil": {"score": cibil_score, "utilization": credit_utilization}
        }

        ai_recommendations = get_dynamic_ai_recommendations(financial_summary_for_ai)

        spending_breakdown = categorized_df[categorized_df['debit'] > 0].groupby('category')['debit'].sum().to_dict()
        spending_breakdown_serializable = {k: int(v) for k, v in spending_breakdown.items()}

        recent_transactions = categorized_df.tail(10).to_dict('records')

        cleaned_transactions = []
        for record in recent_transactions:
            cleaned_record = {}
            for k, v in record.items():
                if pd.isna(v):
                    cleaned_record[k] = None
                else:
                    cleaned_record[k] = v
            cleaned_transactions.append(cleaned_record)


        return jsonify({
            "dashboard_data": {
                "total_income": int(total_income),
                "investments_80c": int(deductions['80C']),
                "spending_breakdown": spending_breakdown_serializable,
                "transactions": cleaned_transactions
            },
            "tax_analysis": {
                "old_regime": {"tax_payable": float(old_tax_payable), "taxable_income": float(old_taxable_income)},
                "new_regime": {"tax_payable": float(new_tax_payable), "taxable_income": float(new_taxable_income)},
                "recommended_regime": recommended_regime,
                "recommendations": ai_recommendations.get("tax_recommendations", []),
            },
            "cibil_analysis": {
                "score": int(cibil_score),
                "recommendations": ai_recommendations.get("cibil_recommendations", []),
                "factors": {"credit_utilization": float(credit_utilization), "credit_mix": "Good"}
            }
        })

    except Exception as e:
        print(f"An error occurred: {e}")
        return jsonify({"error": f"An unexpected error occurred while processing the file: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True)


