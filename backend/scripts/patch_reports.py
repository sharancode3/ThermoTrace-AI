import os

path = os.path.join('frontend', 'src', 'app', '(workspace)', 'reports', 'page.tsx')
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Remove roleProfiles array and roleProfile state
idx1 = text.find('  const [roleProfile')
idx2 = text.find('  const availableSections')
if idx1 != -1 and idx2 != -1:
    replacement_state = '''  const [selectedSections, setSelectedSections] = useState<string[]>([
    "executive_summary",
    "radiometric_telemetry",
    "dual_charts",
    "land_cover",
    "facility_boundary",
    "nearby_infrastructure",
    "nearby_events",
    "provenance"
  ]);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

'''
    text = text[:idx1] + replacement_state + text[idx2:]

# 2. Update handleGenerate
text = text.replace('const activeRole = roleProfiles.find(r => r.id === roleProfile);', '')
text = text.replace('const finalTitle = customTitle || `Dossier (${activeRole?.badge || "AUDIT"}): ${selectedEventId}`;', 'const finalTitle = customTitle.trim() || `Thermal Intelligence Dossier: ${selectedEventId}`;')
text = text.replace('Personalized Dossier ${res.report_id} generated successfully for ${activeRole?.label}!', 'Tactical Dossier ${res.report_id} generated successfully!')

# 3. Remove Step 2 Modal UI
idx3 = text.find('{/* Step 2: Select Operational Role Profile */}')
idx4 = text.find('{/* Step 3: Custom Details */}')
if idx3 != -1 and idx4 != -1:
    text = text[:idx3] + text[idx4:]

text = text.replace('{/* Step 3: Custom Details */}', '{/* Step 2: Custom Details */}')
text = text.replace('{/* Step 4: Modular Sections Selection */}', '{/* Step 3: Modular Sections Selection */}')
text = text.replace('3. Modular Sections to Include in PDF', '2. Analytical Modular Sections to Include in PDF')
text = text.replace('Personalized Intelligence Dossier Studio', 'Thermal Intelligence Dossier Studio')
text = text.replace('Configure report sections, recipient role profile, and compliance focus', 'Generate publication-grade PDF reports with full radiometric and spatial evidence')
text = text.replace('Generate Personalized PDF', 'Generate Tactical Dossier (PDF)')

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print('SUCCESS: frontend reports/page.tsx updated!')