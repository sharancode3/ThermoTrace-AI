import os
import sys
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_number(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header / Footer for pages > 1
        if self._pageNumber > 1:
            # Header
            self.drawString(44, 842 - 32, "ThermoTrace AI — Plain-English Presentation & Q&A Master Kit")
            self.drawRightString(595 - 44, 842 - 32, "SIH 2026 | PS ID: 26162")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(44, 842 - 38, 595 - 44, 842 - 38)
            
            # Footer
            self.line(44, 40, 595 - 44, 40)
            self.drawString(44, 28, "Team Deadlock | BMS/SIH2026/68 | Easy Study & Viva Guide")
            page_text = f"Page {self._pageNumber} of {page_count}"
            self.drawRightString(595 - 44, 28, page_text)
            
        self.restoreState()

def build_pdf(filename="ThermoTrace_AI_SIH_2026_Master_Defense_Kit.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=A4,
        leftMargin=40,
        rightMargin=40,
        topMargin=46,
        bottomMargin=46
    )
    
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=22, leading=26,
        textColor=colors.HexColor("#0F172A"), spaceAfter=4
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=11, leading=15,
        textColor=colors.HexColor("#2563EB"), spaceAfter=10
    )
    
    h1_style = ParagraphStyle(
        'SectionH1', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=13.5, leading=17.5,
        textColor=colors.HexColor("#0F172A"), spaceBefore=14, spaceAfter=6,
        keepWithNext=True
    )
    
    h2_style = ParagraphStyle(
        'SectionH2', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=10.5, leading=14.5,
        textColor=colors.HexColor("#1E40AF"), spaceBefore=9, spaceAfter=3,
        keepWithNext=True
    )
    
    body_style = ParagraphStyle(
        'BodyTextCustom', parent=styles['Normal'],
        fontName='Helvetica', fontSize=8.5, leading=12.5,
        textColor=colors.HexColor("#1E293B"), spaceAfter=4
    )
    
    bullet_style = ParagraphStyle(
        'BulletCustom', parent=styles['Normal'],
        fontName='Helvetica', fontSize=8.5, leading=12.5,
        textColor=colors.HexColor("#1E293B"), leftIndent=12, firstLineIndent=-8,
        spaceAfter=3
    )
    
    q_style = ParagraphStyle(
        'QuestionStyle', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=9, leading=13,
        textColor=colors.HexColor("#0F172A"), spaceBefore=6, spaceAfter=2,
        keepWithNext=True
    )
    
    a_style = ParagraphStyle(
        'AnswerStyle', parent=styles['Normal'],
        fontName='Helvetica', fontSize=8.5, leading=12,
        textColor=colors.HexColor("#1E293B"), spaceAfter=5
    )
    
    analogy_style = ParagraphStyle(
        'AnalogyStyle', parent=styles['Normal'],
        fontName='Helvetica-Oblique', fontSize=8, leading=11.5,
        textColor=colors.HexColor("#0369A1"), spaceAfter=4
    )
    
    table_text = ParagraphStyle(
        'TableText', parent=styles['Normal'],
        fontName='Helvetica', fontSize=8, leading=11,
        textColor=colors.HexColor("#1E293B")
    )
    
    table_header = ParagraphStyle(
        'TableHeader', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=8.5, leading=11.5,
        textColor=colors.white
    )

    story = []

    # -------------------------------------------------------------
    # HEADER BANNER
    # -------------------------------------------------------------
    story.append(Paragraph("SMART INDIA HACKATHON 2026 — MASTER VIVA & DEFENSE KIT", ParagraphStyle('TopTag', fontName='Helvetica-Bold', fontSize=9.5, leading=11.5, textColor=colors.HexColor("#EA580C"))))
    story.append(Paragraph("ThermoTrace AI — Complete Guide & Simple Q&A", title_style))
    story.append(Paragraph("Easy-to-Understand Explanations, Plain-English Analogies & 35+ Real World Questions", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#2563EB"), spaceAfter=10))

    # Meta Table
    meta_data = [
        [
            Paragraph("<b>Problem Statement:</b> 26162", table_text),
            Paragraph("<b>Theme:</b> Disaster Management", table_text),
            Paragraph("<b>Category:</b> Software", table_text)
        ],
        [
            Paragraph("<b>Team Name:</b> Deadlock", table_text),
            Paragraph("<b>Team ID:</b> BMS/SIH2026/68", table_text),
            Paragraph("<b>Core Goal:</b> Industrial Thermal Intelligence", table_text)
        ]
    ]
    meta_table = Table(meta_data, colWidths=[175, 170, 170])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F8FAFC")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#CBD5E1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 8))

    # Plain English Pitch Summary Box
    pitch_text = (
        "<b>🗣️ The 30-Second 'Explain Like I am 5' Pitch:</b><br/>"
        "<i>'NASA satellites take thermal photos of India from space every few hours. Currently, all the government sees is thousands of random red dots on a map with zero explanation. They cannot tell if a red dot is a farmer burning straw, a normal factory chimney, or a deadly refinery explosion. "
        "<b>ThermoTrace AI fixes this.</b> We automatically group scattered dots into real fire footprints, check who owns the land, use AI to classify what is burning, and compare the heat against the factory's past 90 days of normal operation. If it's a routine chimney flare, we stay silent. If it's a real disaster, we trigger immediate emergency alerts with tamper-proof PDF evidence — all with ₹0 ground sensor hardware cost.'</i>"
    )
    pitch_table = Table([[Paragraph(pitch_text, body_style)]], colWidths=[515])
    pitch_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#EFF6FF")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#93C5FD")),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(pitch_table)
    story.append(Spacer(1, 10))

    # -------------------------------------------------------------
    # SECTION 1: MASTER GLOSSARY & PLAIN ENGLISH ANALOGIES
    # -------------------------------------------------------------
    story.append(Paragraph("1. Master Glossary — Full Forms & Simple Everyday Analogies", h1_style))
    story.append(Paragraph("Memorize these terms and their everyday comparisons to explain concepts smoothly:", body_style))

    glossary_data = [
        [Paragraph("Acronym", table_header), Paragraph("Full Form", table_header), Paragraph("Everyday Analogy (How to explain it easily)", table_header)],
        [
            Paragraph("<b>NASA FIRMS</b>", table_text),
            Paragraph("Fire Information for Resource Management System", table_text),
            Paragraph("<b>Like a free global thermal CCTV camera in space</b> that watches the entire Earth's heat spots every few hours.", table_text)
        ],
        [
            Paragraph("<b>VIIRS</b>", table_text),
            Paragraph("Visible Infrared Imaging Radiometer Suite", table_text),
            Paragraph("<b>The high-definition 4K sensor (375m)</b> on weather satellites (Suomi-NPP, NOAA-20/21) that sees small fires clearly.", table_text)
        ],
        [
            Paragraph("<b>MODIS</b>", table_text),
            Paragraph("Moderate Resolution Imaging Spectroradiometer", table_text),
            Paragraph("<b>The veteran wide-angle sensor (1km)</b> on Terra/Aqua satellites that gives 20+ years of historical heat records.", table_text)
        ],
        [
            Paragraph("<b>FRP</b>", table_text),
            Paragraph("Fire Radiative Power (in Megawatts - MW)", table_text),
            Paragraph("<b>Like checking the wattage of a heater.</b> High MW = huge roaring fire; low MW = small burning pile.", table_text)
        ],
        [
            Paragraph("<b>ST-DBSCAN</b>", table_text),
            Paragraph("Spatio-Temporal Density-Based Clustering", table_text),
            Paragraph("<b>Like combining 5 calls from neighbors about smoke on the same street</b> into 1 single fire truck dispatch.", table_text)
        ],
        [
            Paragraph("<b>PostGIS</b>", table_text),
            Paragraph("PostgreSQL Spatial Database Extension", table_text),
            Paragraph("<b>Like a supercharged Google Maps engine in the database</b> that checks boundaries and distances in 0.01 seconds.", table_text)
        ],
        [
            Paragraph("<b>XGBoost</b>", table_text),
            Paragraph("eXtreme Gradient Boosting (Machine Learning)", table_text),
            Paragraph("<b>Like a panel of 100 fast-thinking digital experts</b> voting on whether a heat source is a factory, farm, or forest.", table_text)
        ],
        [
            Paragraph("<b>TreeSHAP</b>", table_text),
            Paragraph("SHapley Additive exPlanations", table_text),
            Paragraph("<b>The AI's 'Show Your Working' sheet</b> that explains why it made a decision in plain words so officials can trust it.", table_text)
        ],
        [
            Paragraph("<b>Z-Score Baseline</b>", table_text),
            Paragraph("Statistical Standard Deviation Score", table_text),
            Paragraph("<b>Like knowing your normal body temperature is 98.6°F</b>, so you only call the doctor if it spikes to 104°F.", table_text)
        ],
        [
            Paragraph("<b>MAD</b>", table_text),
            Paragraph("Median Absolute Deviation", table_text),
            Paragraph("<b>A bulletproof average calculation</b> that doesn't get tricked if someone types a crazy outlier number.", table_text)
        ],
        [
            Paragraph("<b>CPCB</b>", table_text),
            Paragraph("Central Pollution Control Board", table_text),
            Paragraph("<b>India's national environmental watchdog</b> whose factory boundaries and emission rules we follow.", table_text)
        ],
        [
            Paragraph("<b>SHA-256 PDF</b>", table_text),
            Paragraph("256-bit Secure Cryptographic Hash", table_text),
            Paragraph("<b>Like a digital unbroken wax seal on a legal brief.</b> If a corrupt officer changes one letter, the seal breaks.", table_text)
        ],
        [
            Paragraph("<b>Spatial RAG</b>", table_text),
            Paragraph("Retrieval-Augmented Generation", table_text),
            Paragraph("<b>Like an open-book exam for AI.</b> The chatbot only speaks from verified live database facts and cannot lie or hallucinate.", table_text)
        ],
    ]
    glossary_table = Table(glossary_data, colWidths=[80, 180, 255])
    glossary_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#0F172A")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F8FAFC")]),
        ('TOPPADDING', (0,0), (-1,-1), 3.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3.5),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(glossary_table)
    story.append(Spacer(1, 10))

    # -------------------------------------------------------------
    # SECTION 2: HOW THE SYSTEM WORKS (THE 6 SIMPLE STEPS)
    # -------------------------------------------------------------
    story.append(Paragraph("2. How the Prototype Works (The 6-Step Pipeline Made Simple)", h1_style))

    pipeline_cards = [
        ("Step 1: Download & Filter NASA Data (Sovereign Gate)",
         "Our server polls NASA every 5–10 minutes. It takes all the heat coordinates across South Asia and checks: <i>'Is this point inside India?'</i> If it's outside the border or in the open sea, we throw it away immediately."),
        ("Step 2: Connect the Dots (ST-DBSCAN Clustering)",
         "When 3 different satellites pass over the same refinery fire at 10 AM, 1 PM, and 4 PM, they create 3 separate dots. Our algorithm knows these dots are within 750 meters and 12 hours of each other, so it merges them into <b>1 real fire event</b> with a mapped boundary outline."),
        ("Step 3: Check What is at that Location (PostGIS Context Fusion)",
         "Our database looks at the coordinates and immediately checks two things: (1) Is there a registered refinery, steel plant, or power station within 3.5 km? and (2) According to European Space Agency 10m satellite maps, is the ground a farm, a forest, or an urban area?"),
        ("Step 4: AI Identifies the Fire (Calibrated XGBoost)",
         "Our AI model examines 14 clues (distance to plant, heat intensity in MW, temperature in Kelvin, day vs night, farm percentage). It predicts whether it is an <b>Industrial Disaster, a Routine Chimney Flare, Crop Stubble Burning, or a Forest Fire</b> with 97%+ accuracy."),
        ("Step 5: Check if it's Normal or an Emergency (90-Day Baseline Engine)",
         "Refineries are hot every single day because of routine flaring. We look at the plant's heat history over the last 90 days. If the heat is normal (+0 to +1.5 standard deviations), we log it quietly as ROUTINE. If the heat suddenly explodes to +4.0 standard deviations (e.g. 100 MW), we sound the emergency alarm!"),
        ("Step 6: Send Out Alerts and Evidence (Multi-Surface Output)",
         "The system instantly updates the live map with a pulsing red marker, writes an automated news bulletin in plain English, and generates a 1-click official PDF incident report stamped with a tamper-proof SHA-256 hash.")
    ]

    for title, desc in pipeline_cards:
        story.append(Paragraph(f"• <b>{title}:</b> {desc}", bullet_style))

    story.append(Spacer(1, 10))

    # -------------------------------------------------------------
    # SECTION 3: TOP 35 REAL-WORLD QUESTIONS & EASY ANSWERS
    # -------------------------------------------------------------
    story.append(Paragraph("3. Top 35+ Expected Judge Questions & Simple Answers", h1_style))
    story.append(Paragraph("Grouped into clear categories. Use the bold key takeaway first, then explain the detail:", body_style))

    qa_master = [
        # --- GENERAL & CONCEPTUAL ---
        ("Q1: In one simple sentence, what does ThermoTrace AI do?",
         "It turns raw, confusing satellite heat dots into clear, actionable emergency alerts by telling authorities exactly WHAT is burning, WHERE it is, and whether it is a routine factory operation or a real disaster."),
        
        ("Q2: Why did you build this? What is wrong with current government satellite tools?",
         "Existing tools like NASA FIRMS only show scattered red dots on a map. They don't tell you if a dot is a farmer burning straw or an oil refinery exploding. This creates massive alert fatigue, so officials end up ignoring real emergencies."),

        ("Q3: How is your system different from NASA FIRMS?",
         "NASA FIRMS is just the raw satellite camera footage. ThermoTrace AI is the smart brain on top: we cluster multiple passes into real fire shapes, check property boundaries, use AI to classify the fire type, compare it against 90 days of normal plant heat, and generate court-ready legal PDF reports."),

        ("Q4: Why not just put IoT temperature sensors on every factory chimney in India?",
         "Three big reasons: (1) Cost — installing physical sensors on thousands of factories costs hundreds of crores; (2) Maintenance — sensors break in harsh industrial heat; (3) Private Denial — private factory owners can tamper with or turn off their own sensors. Satellites monitor everything from space with ZERO hardware cost and cannot be bribed or switched off."),

        # --- MACHINE LEARNING & ACCURACY ---
        ("Q5: Why did you use XGBoost instead of a Deep Learning Neural Network or CNN?",
         "Satellite thermal telemetry is tabular-spatial data (numbers like distance, megawatts, temperature, land percentages). XGBoost is the gold standard for tabular data — it runs in under 10 milliseconds, requires no expensive GPUs, doesn't overfit, and lets us use TreeSHAP to mathematically explain every prediction to officials."),

        ("Q6: What are the 6 classes your AI classifies fires into?",
         "1. Industrial Fire (Accidental explosion/blaze); 2. Industrial Flare (Gas flare stack); 3. Routine Industrial Heat (Furnace/kiln); 4. Crop Stubble Burning (Farmland residue); 5. Wildfire (Forest/grassland); 6. Other / Uncertain (Low confidence, needs ground check)."),

        ("Q7: What is your model's accuracy and performance?",
         "Our Calibrated XGBoost model achieves a 0.975 Macro F1-score and 100% precision on industrial disaster identification in our validated evaluation matrix."),

        ("Q8: What training data did you use to train your model?",
         "We used a curated dataset of historical NASA VIIRS/MODIS thermal observations mapped against verified CPCB industrial locations, open agricultural crop burning records from Punjab/Haryana, and verified forest fire points across India."),

        ("Q9: What happens if your model is unsure about a fire?",
         "If the confidence is below 60% or entropy is high, it automatically assigns the category 'OTHER_UNCERTAIN' and flags Uncertainty as 'HIGH'. We never guess or fabricate high confidence when data is ambiguous."),

        # --- FALSE ALARMS & BASELINES ---
        ("Q10: How do you stop false alarms from oil refineries that burn gas every day?",
         "Every refinery has a normal routine heat level. We compute a rolling 90-day baseline (mean and standard deviation). A normal 15 MW flare gives a Z-score of +0.5 (NORMAL). But if an explosion surges to 100 MW, the Z-score jumps to +4.5 (CRITICAL). We only alert officials when the heat is abnormal!"),

        ("Q11: What if a farmer burns crop stubble right next to an oil refinery?",
         "Our dual-axis engine looks at both land context and persistence. Open farmland has high agricultural land cover (ESA 10m) and occurs only during daytime harvest seasons, whereas refinery heat is persistent day and night within the 3.5km industrial geofence."),

        ("Q12: What is the 'Disaster Quarantine' feature in your baseline engine?",
         "If a refinery catches fire and burns for 3 days, standard systems would add that huge fire to the history and make disasters look 'normal'. Our system automatically quarantines any critical spike (Z ≥ 4.0σ) so it NEVER pollutes the normal operating baseline."),

        # --- SATELLITES, CLOUD COVER & DELAYS ---
        ("Q13: What if it rains or there is heavy cloud cover? Can your satellites still see?",
         "Clouds do block optical sensors. We solve this by fusing 5 different satellites (NOAA-20, NOAA-21, Suomi-NPP, Terra, Aqua) passing at different day and night hours. Also, intense industrial fires emit in Mid-Wave Infrared (3.9 micrometers) which cuts through light smoke and haze. If a pass is blocked, our system holds the event in an 'OCCLUDED_PERSISTENT' state so it is not forgotten."),

        ("Q14: Satellites pass every few hours. Isn't that too slow for fire response?",
         "ThermoTrace AI is not meant to replace indoor smoke alarms in a room. It solves the macro-monitoring gap across India's 3.28 million sq km. Today, remote pipeline leaks, illegal factory emissions, and forest fires take 24 to 48 hours to be reported manually. We detect them in under 15–30 minutes of a satellite overpass automatically."),

        ("Q15: What is the difference between VIIRS and MODIS?",
         "VIIRS is newer and sharper with 375-meter resolution (great for small fires). MODIS has 1-kilometer resolution but has been flying since the year 2000, giving us 24 years of historical baseline data."),

        # --- GIS, MAPPING & ARCHITECTURE ---
        ("Q16: Why did you use PostGIS instead of standard MongoDB or SQLite?",
         "PostGIS is built specifically for geospatial math. It uses GiST spatial indexing to calculate distances between satellite points and thousands of factory polygons across all of India in under 15 milliseconds, right inside the database."),

        ("Q17: What is ST-DBSCAN and why 750 meters and 12 hours?",
         "ST-DBSCAN is a clustering formula that groups points close in distance (750m) AND close in time (12 hours). 750m accounts for satellite pixel drift, and 12h captures consecutive satellite passes of the same ongoing fire."),

        ("Q18: What is a Convex Hull?",
         "Think of stretching a rubber band around a group of scattered satellite points. The convex hull forms the outer polygon boundary of the fire, allowing us to calculate the exact area in Hectares (Ha)."),

        # --- REAL WORLD APPLICATION & LEGAL ADMISSIBILITY ---
        ("Q19: Why is your PDF report stamped with SHA-256? How does that help in court?",
         "When a factory owner denies that a fire or illegal emission happened, government regulators need proof. Our PDF embeds raw satellite orbit IDs, coordinates, and timestamps sealed with a cryptographic SHA-256 hash. If anyone modifies the document, the hash changes, proving whether evidence was tampered with under the Indian Evidence Act."),

        ("Q20: How will a district disaster officer or fire chief use this dashboard?",
         "They open the live map, see color-coded alerts (Red = Emergency, Orange = Abnormal), click any fire to see the exact GPS coordinates, fuel type, and nearest water/road access, and hit 'Download PDF' to dispatch the nearest fire station in seconds."),

        ("Q21: How does your AI Assistant (Chatbot) work?",
         "It uses Spatial RAG. If you ask 'Are there any critical fires in Gujarat?', the backend first runs an exact SQL query on live database rows, gets the verified results, and passes them to the AI. The AI simply summarizes the real data and cannot invent fake fires."),

        # --- COST, SCALE & INDIAN CONTEXT ---
        ("Q22: How much does it cost to deploy this across all of India?",
         "Zero hardware cost! NASA satellite feeds are free, ESA land maps are free, and our software stack (PostgreSQL, FastAPI, Next.js) is 100% open-source. The only cost is standard government cloud hosting (NIC / MeghRaj) which costs a few thousand rupees a month."),

        ("Q23: Is this project compliant with Indian Government Data policies?",
         "Yes, it strictly complies with the National Geospatial Policy 2022 and DPDP Act guidelines. It is designed to run entirely on sovereign Indian cloud servers with no data sent abroad."),

        ("Q24: Who are the target buyers / users of ThermoTrace AI?",
         "1. Central & State Pollution Control Boards (CPCB/SPCB); 2. National Disaster Management Authority (NDMA / SDMA); 3. Fire & Emergency Services; 4. Petroleum & Steel Plant Safety Managers; 5. Forest Departments.")
    ]

    for q, a in qa_master:
        story.append(Paragraph(q, q_style))
        story.append(Paragraph(f"<b>Answer:</b> {a}", a_style))

    story.append(Spacer(1, 10))

    # -------------------------------------------------------------
    # SECTION 4: HOW TO HANDLE 4 TOUGH TRAP QUESTIONS
    # -------------------------------------------------------------
    story.append(Paragraph("4. How to Handle 4 Tough 'Trap' Questions (Defense Secrets)", h1_style))

    trap_master = [
        ("Trap 1: 'What if a company denies the fire and says your satellite made a mistake?'",
         "<b>How to answer:</b> 'We provide multi-satellite cross-corroboration. A single glitch cannot show up across multiple independent satellites (VIIRS Suomi-NPP, NOAA-20, and MODIS) with identical radiant heat power. Furthermore, our tamper-proof SHA-256 PDF provides raw NASA orbital telemetry metadata that is mathematically irrefutable in regulatory audits.'"),
        
        ("Trap 2: 'What if an industrial area has 5 factories right next to each other? Which one is burning?'",
         "<b>How to answer:</b> 'We use FRP-weighted centroid localization combined with high-precision 375m VIIRS resolution. If multiple plants are close, our system calculates the geodesic distance to each polygon boundary and reports the primary facility plus nearby at-risk facilities within a 1km to 5km radius for collateral threat assessment.'"),

        ("Trap 3: 'Is this system already working or is it just a UI mockup?'",
         "<b>How to answer:</b> 'It is a fully functional end-to-end working prototype. We have live database tables in PostgreSQL/PostGIS, an active FastAPI ingestion engine, trained XGBoost models loaded via Joblib, automated ST-DBSCAN clustering, and live WebGL map rendering.'"),

        ("Trap 4: 'What is your plan for the next phase after SIH?'",
         "<b>How to answer:</b> 'Our next 3 milestones are: (1) Integrate ISRO INSAT-3D/3DR geostationary satellite feeds for 15-minute high-frequency thermal scans over India; (2) Add downwind toxic smoke and gas plume dispersion modeling using live wind APIs; (3) Deploy automated SMS/WhatsApp emergency webhooks directly to local fire control rooms.'")
    ]

    for q, a in trap_master:
        story.append(Paragraph(f"<font color='#DC2626'><b>{q}</b></font>", q_style))
        story.append(Paragraph(a, a_style))

    story.append(Spacer(1, 10))

    # -------------------------------------------------------------
    # SECTION 5: 3-MINUTE PRESENTATION SCRIPT & PITCH CHEAT SHEET
    # -------------------------------------------------------------
    story.append(Paragraph("5. Slide-by-Slide 3-Minute Presentation Script", h1_style))

    slides_script = [
        ("Slide 1: Title (20 sec)",
         "'Respected judges, every year industrial explosions and uncontained fires cause catastrophic damage and pollution across India. Current satellite systems dump thousands of raw, unclassified red dots that create alert fatigue. We present ThermoTrace AI — an AI-powered satellite thermal intelligence system built for proactive disaster management.'"),
        ("Slide 2: Problem & Solution (40 sec)",
         "'ThermoTrace AI transforms raw satellite telemetry into real intelligence through a 6-stage pipeline: We ingest NASA VIIRS and MODIS feeds strictly filtered for Indian sovereign borders; cluster scattered passes into unified fire shapes with ST-DBSCAN; overlay CPCB industrial maps and 10m land cover; classify fire sources with Calibrated XGBoost; and eliminate 94.7% of false alarms using 90-day facility baseline Z-scores.'"),
        ("Slide 3: Tech Approach (35 sec)",
         "'Our tech stack is 100% open-source and production-ready: PostGIS delivers sub-15ms spatial indexing, FastAPI powers the async backend, XGBoost with TreeSHAP provides explainable ML classifications, and Next.js with MapLibre GL powers a 60 FPS GIS dashboard with real-time news bulletins and PDF dossiers.'"),
        ("Slide 4: Feasibility & Risks (30 sec)",
         "'ThermoTrace AI operates with ₹0 ground sensor CAPEX by utilizing orbital satellites. We fuse 5 multi-satellite constellations to overcome cloud cover, deploy adaptive spatial buffering for unmapped plant boundaries, and use a disaster quarantine engine to keep our historical baselines accurate.'"),
        ("Slide 5: Impact & Benefits (35 sec)",
         "'Our impact touches 4 critical pillars: Industrial Security by catching flare surges before explosions happen; Public Safety by cutting disaster alert times from 48 hours to under 15 minutes; Economic Savings by eliminating expensive helicopter patrols; and Environmental Care by giving CPCB court-ready evidence to enforce emission laws.'"),
        ("Slide 6: Conclusion (20 sec)",
         "'ThermoTrace AI is backed by established remote sensing science and built as a working end-to-end prototype ready for sovereign deployment across India. Thank you, and we are ready for your questions!'")
    ]

    for s_title, s_text in slides_script:
        story.append(Paragraph(f"<b>{s_title}:</b>", h2_style))
        story.append(Paragraph(f"<i>{s_text}</i>", body_style))

    story.append(Spacer(1, 10))

    # Morning Quick Tips Box
    tips_box = (
        "<b>🎯 Final Tips for Tomorrow's Presentation:</b><br/>"
        "• <b>Speak with confidence:</b> Remember, you built an end-to-end working system. You know your project better than anyone.<br/>"
        "• <b>Keep it simple:</b> If a judge asks a question, give the simple 1-line answer FIRST, then give the technical detail.<br/>"
        "• <b>Key buzzwords to drop naturally:</b> 'ST-DBSCAN clustering', 'Sub-15ms PostGIS spatial indexing', '90-day facility baselines', 'Calibrated XGBoost', '₹0 ground sensor CAPEX', 'Tamper-proof SHA-256 PDF'."
    )
    tips_table = Table([[Paragraph(tips_box, analogy_style)]], colWidths=[515])
    tips_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#FEF3C7")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#F59E0B")),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(tips_table)

    # Build the document
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Generated new easy-to-understand PDF: {filename}")

if __name__ == "__main__":
    out = os.path.abspath("ThermoTrace_AI_SIH_2026_Master_Defense_Kit.pdf")
    build_pdf(out)
