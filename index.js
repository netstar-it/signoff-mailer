const express = require('express');
const cors = require('cors');
const PDFDocument = require('pdfkit');
const app = express();

app.use(cors({ origin: '*', methods: ['GET','POST','OPTIONS'], allowedHeaders: ['Content-Type'] }));
app.options('*', cors());
app.use(express.json({ limit: '10mb' }));

const NAVY  = '#1E3A8A';
const CYAN  = '#00AEEF';
const GREY  = '#555555';
const LIGHT = '#F5F6FA';
const GREEN = '#16A34A';
const AMBER = '#D97706';

function buildPDF(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: 'Netstar Device Installation Sign-off' } });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width - 80; // usable width
    const L = 40; // left margin

    // ── Header bar ──────────────────────────────────────────────
    doc.rect(L, 30, W, 70).fill(NAVY);

    // Logo text (since we can't embed image in pdfkit without file path easily)
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(22).text('NETSTAR', L + 14, 48);
    doc.fillColor(CYAN).rect(L + 14, 72, 90, 3).fill();
    doc.fillColor('#FFFFFF').font('Helvetica').fontSize(8).text('A SUBSIDIARY OF ALTRON', L + 14, 78);

    // Title right side
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(13)
       .text('Device Installation Sign-off', L, 45, { width: W, align: 'right' });
    doc.fillColor('rgba(255,255,255,0.7)').font('Helvetica').fontSize(9)
       .text(new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' }), L, 64, { width: W, align: 'right' });

    let y = 118;

    // ── Section helper ───────────────────────────────────────────
    function sectionHeader(title) {
      doc.rect(L, y, W, 20).fill(NAVY);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8)
         .text(title.toUpperCase(), L + 8, y + 6);
      y += 24;
    }

    // ── Table row helper ─────────────────────────────────────────
    function tableRow(label, value, shade) {
      const rowH = 20;
      if (shade) doc.rect(L, y, W, rowH).fill(LIGHT);
      doc.rect(L, y, W, rowH).stroke('#E0E2EA');
      doc.fillColor(GREY).font('Helvetica').fontSize(9)
         .text(label, L + 8, y + 6, { width: W * 0.38 });
      doc.fillColor('#1a1a1a').font('Helvetica-Bold').fontSize(9)
         .text(value || '—', L + W * 0.4, y + 6, { width: W * 0.58 });
      y += rowH;
    }

    // ── Checklist row ────────────────────────────────────────────
    function checkRow(label, status, shade) {
      const rowH = 20;
      if (shade) doc.rect(L, y, W, rowH).fill(LIGHT);
      doc.rect(L, y, W, rowH).stroke('#E0E2EA');
      doc.fillColor('#1a1a1a').font('Helvetica').fontSize(9)
         .text(label, L + 8, y + 6, { width: W * 0.72 });

      // Badge
      let bgColor, txtColor, txt;
      if (status === 'dn')      { bgColor='#DCFCE7'; txtColor=GREEN;  txt='✓ Installed'; }
      else if (status === 'na') { bgColor='#F0F0F5'; txtColor='#888'; txt='N/A'; }
      else                      { bgColor='#FEF3C7'; txtColor=AMBER;  txt='Pending'; }

      const bx = L + W - 72, bw = 65, bh = 14, by = y + 3;
      doc.rect(bx, by, bw, bh).fill(bgColor);
      doc.fillColor(txtColor).font('Helvetica-Bold').fontSize(8)
         .text(txt, bx, by + 3, { width: bw, align: 'center' });
      y += rowH;
    }

    // ── Job details ──────────────────────────────────────────────
    sectionHeader('Installation Details');
    tableRow('Technician', data.techName, false);
    tableRow('Date', data.jobDate, true);
    tableRow('User', data.userName, false);
    tableRow('Department', data.dept, true);
    tableRow('Device', data.device, false);
    if (data.userPhone && data.userPhone !== '—') tableRow('User contact', data.userPhone, false);
    if (data.userEmail && data.userEmail !== '—') tableRow('User email', data.userEmail, true);
    if (data.startTime && data.startTime !== '—') tableRow('Start time', data.startTime, false);
    if (data.endTime && data.endTime !== '—') tableRow('End time', data.endTime, true);
    if (data.kmTo && data.kmTo !== '—') tableRow('KMs to site', data.kmTo + ' km', false);
    if (data.kmFrom && data.kmFrom !== '—') tableRow('KMs from site', data.kmFrom + ' km', true);
    if (data.notes && data.notes !== '—') tableRow('Notes', data.notes, false);
    y += 8;

    // ── Pre-requisites ───────────────────────────────────────────
    sectionHeader('Pre-requisites');
    const preLabels = ['OneDrive backup confirmed', 'User PST files backed up'];
    preLabels.forEach((lbl, i) => {
      const done = data.preChecks && data.preChecks[i];
      const rowH = 20;
      if (i % 2 === 1) doc.rect(L, y, W, rowH).fill(LIGHT);
      doc.rect(L, y, W, rowH).stroke('#E0E2EA');
      doc.fillColor('#1a1a1a').font('Helvetica').fontSize(9).text(lbl, L + 8, y + 6);
      const bx = L + W - 72, bw = 65, bh = 14, by = y + 3;
      if (done) {
        doc.rect(bx, by, bw, bh).fill('#DCFCE7');
        doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(8).text('✓ Done', bx, by + 3, { width: bw, align: 'center' });
      } else {
        doc.rect(bx, by, bw, bh).fill('#FEF3C7');
        doc.fillColor(AMBER).font('Helvetica-Bold').fontSize(8).text('Pending', bx, by + 3, { width: bw, align: 'center' });
      }
      y += rowH;
    });
    y += 8;

    // ── Software checklist ───────────────────────────────────────
    const DEPTS = {
      "Common (all devices)":["Office: Outlook","Teams","OneDrive","VPN","Printer","Company Portal (O365)","Intune","N-able"],
      "Customer Service":["Ocular","3CX","Noms","Search Utilities","CRM and AX"],
      "Finance":["Ocular","3CX","CRM and AX","New Z drive (differs per user)"],
      "Sales":["Ask supervisor / manager"],
      "Telesure":["CRM","Ocular","AS400","3CX"],
      "Planning":["CRM","Ocular","Search Utilities","3CX"],
      "ECC":["Ocular","Noms","Search Utilities"],
      "Telesales":["CRM","Ocular","3CX"],
      "Retentions":["CRM","Ocular","3CX"],
      "Technician":["Teltronica","PCatu 570","PCatu v17","Ezgrabber"],
      "Managers / Supervisors":["MS Project","MS Visio","Power BI"]
    };

    const depts = ["Common (all devices)"];
    if (data.dept && !depts.includes(data.dept)) depts.push(data.dept);

    sectionHeader('Software Installation Checklist');
    depts.forEach(dept => {
      const items = DEPTS[dept] || [];
      if (!items.length) return;

      // Check if we need a new page
      if (y + (items.length + 1) * 20 > doc.page.height - 120) {
        doc.addPage();
        y = 40;
      }

      // Sub-section label
      doc.rect(L, y, W, 18).fill('#E8EAF2');
      doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(8).text(dept, L + 8, y + 5);
      y += 18;

      items.forEach((item, i) => {
        if (y > doc.page.height - 100) { doc.addPage(); y = 40; }
        const status = data.checklist && data.checklist[dept] && data.checklist[dept][item];
        checkRow(item, status, i % 2 === 1);
      });
      y += 4;
    });

    y += 8;

    // ── Signatures ───────────────────────────────────────────────
    if (y + 100 > doc.page.height - 60) { doc.addPage(); y = 40; }
    sectionHeader('Signatures');

    const sigLabels = ['Technician', 'Supervisor'];
    const sigData   = [data.techSig, data.supSig];

    sigLabels.forEach((lbl, i) => {
      const rowH = 70;
      if (y + rowH > doc.page.height - 60) { doc.addPage(); y = 40; }
      if (i % 2 === 1) doc.rect(L, y, W, rowH).fill(LIGHT);
      doc.rect(L, y, W, rowH).stroke('#E0E2EA');
      doc.fillColor(GREY).font('Helvetica-Bold').fontSize(9).text(lbl, L + 8, y + 8);

      if (sigData[i] && sigData[i].startsWith('data:image')) {
        try {
          const matches = sigData[i].match(/^data:(image\/\w+);base64,(.+)$/);
          if (matches) {
            const imgBuf = Buffer.from(matches[2], 'base64');
            doc.image(imgBuf, L + W * 0.35, y + 7, { fit: [200, 54] });
          } else {
            throw new Error('bad data URI');
          }
        } catch(e) {
          doc.fillColor('#aaa').font('Helvetica').fontSize(8).text('Signature captured digitally', L + W * 0.35, y + 28);
        }
      } else {
        doc.fillColor('#aaa').font('Helvetica').fontSize(8).text('No signature provided', L + W * 0.35, y + 28);
      }
      y += rowH;
    });

    y += 12;

    // ── Footer ───────────────────────────────────────────────────
    const footerY = doc.page.height - 50;
    doc.rect(L, footerY, W, 28).fill(NAVY);
    doc.fillColor('rgba(255,255,255,0.7)').font('Helvetica').fontSize(8)
       .text(`Netstar — A Subsidiary of Altron  ·  Both parties have signed off digitally  ·  Generated: ${new Date().toLocaleString('en-ZA')}`,
         L, footerY + 10, { width: W, align: 'center' });

    doc.end();
  });
}

app.post('/send', async (req, res) => {
  const { to, toName, subject, data } = req.body;
  if (!to || !subject || !data) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  let pdfBase64 = '';
  try {
    const pdfBuf = await buildPDF(data);
    pdfBase64 = pdfBuf.toString('base64');
  } catch (err) {
    return res.status(500).json({ error: 'PDF generation failed: ' + err.message });
  }

  const safeName = (data.userName || 'User').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeDate = (data.jobDate || 'date').replace(/\//g, '-');
  const filename = `Netstar_SignOff_${safeName}_${safeDate}.pdf`;

  const payload = {
    sender: { name: process.env.FROM_NAME || 'IT Department', email: process.env.FROM_EMAIL },
    to: [{ email: to, name: toName || to }],
    subject,
    htmlContent: `<div style="font-family:sans-serif;padding:20px;">
      <h2 style="color:#1E3A8A;">Device Installation Sign-off Complete</h2>
      <p>Hi,</p>
      <p>Please find attached the completed device installation sign-off report for <strong>${data.userName}</strong> (${data.dept}) dated ${data.jobDate}.</p>
      <p>The checklist has been completed and both the technician and supervisor have signed off digitally.</p>
      <br/>
      <p style="color:#888;font-size:12px;">Netstar — A Subsidiary of Altron</p>
    </div>`,
    attachment: [{ content: pdfBase64, name: filename }]
  };

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': process.env.BREVO_API_KEY },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (response.ok) return res.json({ success: true, messageId: result.messageId });
    return res.status(response.status).json({ error: result.message || 'Brevo error' });
  } catch (err) {
    return res.status(500).json({ error: 'Send failed: ' + err.message });
  }
});

app.get('/', (req, res) => res.json({ status: 'Netstar sign-off mailer running' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on port ${PORT}`));
