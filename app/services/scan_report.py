from io import BytesIO
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models.model_version import ModelVersion
from app.models.prediction import Prediction
from app.models.scan import Scan
from app.models.user import User


def build_scan_report(scan: Scan, patient: User, prediction: Prediction, model_version: ModelVersion) -> bytes:
    """Build the fixed single-page-style MedScan PDF report in memory."""
    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer, pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm,
        topMargin=17 * mm, bottomMargin=17 * mm,
        title=f"Respiratory screening report - {scan.id}", author="MedScan",
    )
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="ReportTitle", parent=styles["Title"], alignment=TA_CENTER, textColor=colors.HexColor("#243640"), fontSize=18, leading=22, spaceAfter=5))
    styles.add(ParagraphStyle(name="SectionTitle", parent=styles["Heading2"], textColor=colors.HexColor("#397c83"), fontSize=12, leading=15, spaceBefore=10, spaceAfter=5))
    styles.add(ParagraphStyle(name="SmallNote", parent=styles["BodyText"], textColor=colors.HexColor("#526970"), fontSize=8.5, leading=12))

    story = [
        Paragraph("Respiratory Screening Report", styles["ReportTitle"]),
        Paragraph("AI-assisted screening summary · Not a final medical diagnosis", styles["SmallNote"]),
        Spacer(1, 9),
        Paragraph("Patient and scan", styles["SectionTitle"]),
    ]
    patient_rows = [
        ["Patient", patient.full_name], ["Email", patient.email],
        ["Scan date", scan.created_at.strftime("%Y-%m-%d %H:%M UTC")], ["Scan ID", str(scan.id)],
    ]
    patient_table = Table(patient_rows, colWidths=[35 * mm, 135 * mm])
    patient_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f1f5f6")),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#243640")),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), .35, colors.HexColor("#dce5e8")), ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    issue_text = ", ".join(scan.quality_issues or []) or "No quality issues detected"
    story.extend([patient_table, Paragraph("Image quality", styles["SectionTitle"]), Paragraph(
        f"Reliability score: <b>{scan.quality_score} / 100</b> · Status: <b>{scan.quality_status.value.upper()}</b><br/>Issues: {issue_text}",
        styles["BodyText"],
    ), Paragraph("AI differential analysis", styles["SectionTitle"])])

    probability_rows = [["Class", "Probability"]]
    for label, value in (
        ("Normal", prediction.normal_probability), ("Pneumonia", prediction.pneumonia_probability),
        ("Tuberculosis", prediction.tuberculosis_probability), ("Other", prediction.other_probability),
    ):
        probability_rows.append([label, f"{value * 100:.2f}%"])
    probability_table = Table(probability_rows, colWidths=[130 * mm, 40 * mm], repeatRows=1)
    probability_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eaf1f2")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#243640")),
        ("FONTSIZE", (0, 0), (-1, -1), 9), ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("GRID", (0, 0), (-1, -1), .35, colors.HexColor("#dce5e8")),
        ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.extend([
        probability_table,
        Paragraph(f"AI confidence: {prediction.ai_confidence * 100:.2f}% · Model version: {model_version.version}", styles["SmallNote"]),
        Paragraph("Grad-CAM explainability", styles["SectionTitle"]),
    ])
    heatmap_path = Path(prediction.gradcam_path)
    if heatmap_path.is_file():
        story.extend([
            Image(str(heatmap_path), width=150 * mm, height=95 * mm, kind="proportional"),
            Paragraph("Highlighted regions most influenced the model prediction. This is an interpretability aid, not medical confirmation.", styles["SmallNote"]),
        ])
    else:
        story.append(Paragraph("Grad-CAM image is unavailable for this scan.", styles["SmallNote"]))
    story.extend([
        Spacer(1, 8), Paragraph(f"Doctor verification: <b>{scan.doctor_review_status.upper()}</b>", styles["BodyText"]),
        Spacer(1, 5), Paragraph("This AI-generated result is not a final medical diagnosis. A licensed doctor must review and verify the result.", styles["SmallNote"]),
    ])
    document.build(story)
    return buffer.getvalue()
