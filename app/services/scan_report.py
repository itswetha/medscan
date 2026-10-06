from io import BytesIO
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Flowable, HRFlowable, Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models.model_version import ModelVersion
from app.models.prediction import Prediction
from app.models.scan import Scan
from app.models.user import User


BLUE = colors.HexColor("#1D4ED8")
INK = colors.HexColor("#243640")
MUTED = colors.HexColor("#526970")
LINE = colors.HexColor("#D8E2F0")
PALE_BLUE = colors.HexColor("#EFF6FF")


class ProbabilityBar(Flowable):
    def __init__(self, value: float, width: float = 105 * mm, height: float = 4 * mm):
        super().__init__()
        self.value = max(0.0, min(1.0, float(value)))
        self.width = width
        self.height = height

    def draw(self):
        self.canv.setFillColor(PALE_BLUE)
        self.canv.rect(0, 0, self.width, self.height, stroke=0, fill=1)
        if self.value > 0:
            self.canv.setFillColor(BLUE)
            self.canv.rect(0, 0, self.width * self.value, self.height, stroke=0, fill=1)


def draw_header(canvas, document):
    canvas.saveState()
    page_width, page_height = A4
    canvas.setFillColor(BLUE)
    canvas.rect(0, page_height - 22 * mm, page_width, 22 * mm, stroke=0, fill=1)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 17)
    canvas.drawString(document.leftMargin, page_height - 14 * mm, "VitalScan")
    canvas.setFont("Helvetica", 9)
    canvas.drawRightString(page_width - document.rightMargin, page_height - 14 * mm, "CLINICAL SCREENING REPORT")
    canvas.restoreState()


def build_scan_report(scan: Scan, patient: User, prediction: Prediction, model_version: ModelVersion) -> bytes:
    """Build the clinical screening PDF report in memory."""
    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer, pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm,
        topMargin=29 * mm, bottomMargin=17 * mm,
        title=f"Respiratory screening report - {scan.id}", author="VitalScan",
    )
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="ReportTitle", parent=styles["Title"], alignment=TA_LEFT, textColor=INK, fontSize=17, leading=21, spaceAfter=4))
    styles.add(ParagraphStyle(name="SectionTitle", parent=styles["Heading2"], textColor=BLUE, fontSize=11, leading=14, spaceBefore=3, spaceAfter=5))
    styles.add(ParagraphStyle(name="SmallNote", parent=styles["BodyText"], textColor=MUTED, fontSize=8.5, leading=12))
    styles.add(ParagraphStyle(name="Callout", parent=styles["BodyText"], textColor=INK, fontSize=8.5, leading=12))

    story = [
        Paragraph("Respiratory screening summary", styles["ReportTitle"]),
        Paragraph("AI-assisted screening · For clinician review", styles["SmallNote"]),
        Spacer(1, 5),
        Paragraph("Patient Info", styles["SectionTitle"]),
    ]
    patient_rows = [
        ["Patient", patient.full_name], ["Email", patient.email],
        ["Scan date", scan.created_at.strftime("%Y-%m-%d %H:%M UTC")], ["Scan ID", str(scan.id)],
    ]
    patient_table = Table(patient_rows, colWidths=[35 * mm, 135 * mm])
    patient_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), PALE_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, -1), INK),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), .35, LINE), ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    issue_text = ", ".join(scan.quality_issues or []) or "No quality issues detected"
    section_rule = lambda: HRFlowable(width="100%", thickness=0.8, color=BLUE, spaceBefore=5, spaceAfter=5)
    story.extend([patient_table, section_rule(), Paragraph("Image Quality", styles["SectionTitle"]), Paragraph(
        f"Reliability score: <b>{scan.quality_score} / 100</b> · Status: <b>{scan.quality_status.value.upper()}</b><br/>Issues: {issue_text}",
        styles["BodyText"],
    ), section_rule(), Paragraph("AI Findings", styles["SectionTitle"])])

    probability_rows = [["Finding", "Probability", ""]]
    for label, value in (
        ("Normal", prediction.normal_probability), ("Pneumonia", prediction.pneumonia_probability),
        ("Tuberculosis", prediction.tuberculosis_probability), ("Other", prediction.other_probability),
    ):
        probability_rows.append([label, ProbabilityBar(value), f"{value * 100:.2f}%"])
    probability_table = Table(probability_rows, colWidths=[32 * mm, 116 * mm, 26 * mm], repeatRows=1)
    probability_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PALE_BLUE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("TEXTCOLOR", (0, 0), (-1, -1), INK),
        ("FONTSIZE", (0, 0), (-1, -1), 9), ("ALIGN", (2, 0), (2, -1), "RIGHT"),
        ("LINEBELOW", (0, 0), (-1, 0), .35, LINE), ("LINEBELOW", (0, 1), (-1, -1), .25, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.extend([
        probability_table,
        Paragraph(f"AI confidence: {prediction.ai_confidence * 100:.2f}% · Model version: {model_version.version}", styles["SmallNote"]),
        section_rule(),
        Paragraph("AI Explanation", styles["SectionTitle"]),
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
        section_rule(),
        Paragraph("Doctor Review", styles["SectionTitle"]),
        Paragraph(f"Doctor verification: <b>{scan.doctor_review_status.upper()}</b>", styles["BodyText"]),
    ])
    disclaimer = Table(
        [[Paragraph("This AI-generated result is not a final medical diagnosis. A licensed doctor must review and verify the result.", styles["Callout"])]],
        colWidths=[174 * mm],
    )
    disclaimer.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PALE_BLUE),
        ("BOX", (0, 0), (-1, -1), 0.8, BLUE),
        ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    story.extend([Spacer(1, 8), disclaimer])
    document.build(story, onFirstPage=draw_header, onLaterPages=draw_header)
    return buffer.getvalue()
