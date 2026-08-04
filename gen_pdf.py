import os, markdown, weasyprint

ROOT = '/tmp/routefleet'
files = [
    ('README.md', 'KAVANA RouteFleet'),
    ('docs/ARQUITECTURA.md', 'Arquitectura'),
    ('docs/BACKEND.md', 'Backend API'),
    ('docs/API.md', 'API (endpoints)'),
    ('docs/APP_REPARTIDOR.md', 'App del Repartidor'),
    ('docs/PANEL_OFICINAS.md', 'Panel de Oficinas (Torre de Control)'),
    ('docs/DESPLIEGUE.md', 'Despliegue'),
]

css = """
@page { size: A4; margin: 18mm 16mm; }
body { font-family: system-ui, 'Segoe UI', Arial, sans-serif; color:#1a2230; font-size: 11px; line-height: 1.5; }
h1 { color:#FF3D00; font-size: 24px; border-bottom:3px solid #FF3D00; padding-bottom:6px; }
h2 { color:#171a21; font-size:18px; margin-top:26px; border-bottom:1px solid #d9dee3; padding-bottom:4px; }
h3 { color:#2563eb; font-size:14px; }
code, pre { background:#f4f6f8; border:1px solid #d9dee3; border-radius:4px; padding:2px 5px; font-size:10px; }
pre { padding:10px; overflow-x:auto; }
table { border-collapse: collapse; width:100%; margin:10px 0; font-size:10px; }
th, td { border:1px solid #d9dee3; padding:6px 8px; text-align:left; }
th { background:#171a21; color:#fff; }
blockquote { border-left:4px solid #FF3D00; margin:10px 0; padding:4px 12px; background:#fff7f4; color:#6b7682; }
a { color:#2563eb; }
"""

html_parts = ['<html><head><meta charset="utf-8"></head><body>']
html_parts.append('<h1>KAVANA RouteFleet — Documentación Completa (v2)</h1>')
html_parts.append('<p style="color:#6b7682;">Recopilación de README y documentación técnica. Dominio: routefleet.kavanasystems.com</p>')

for rel, title in files:
    path = os.path.join(ROOT, rel)
    if not os.path.exists(path):
        continue
    with open(path, encoding='utf-8') as f:
        md = f.read()
    # Quita badges/frontmatter si los hubiera
    body = markdown.markdown(md, extensions=['tables', 'fenced_code'])
    html_parts.append(f'<h2>{title}</h2>')
    html_parts.append(body)

html_parts.append('</body></html>')
full_html = '\n'.join(html_parts)

out = os.path.join(ROOT, 'RouteFleet-Documentacion-v2.pdf')
weasyprint.HTML(string=full_html).write_pdf(out, stylesheets=[weasyprint.CSS(string=css)])
print('PDF generado:', out, os.path.getsize(out), 'bytes')
