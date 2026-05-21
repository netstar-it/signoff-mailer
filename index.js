const express = require('express');
const cors = require('cors');
const PDFDocument = require('pdfkit');
const app = express();

app.use(cors({ origin: '*', methods: ['GET','POST','OPTIONS'], allowedHeaders: ['Content-Type'] }));
app.options('*', cors());
app.use(express.json({ limit: '10mb' }));

function buildPDF(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 22, bufferPages: true, autoFirstPage: true, info: { Title: 'Netstar Device Installation Sign-off' } });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const PW = doc.page.width;
    const PH = doc.page.height;
    const L = 22, R = PW - 22;
    const W = R - L;
    const NAVY = '#1E3A8A', CYAN = '#00AEEF', GREY = '#555555';
    const LIGHT = '#F5F6FA', GREEN = '#16A34A', AMBER = '#D97706';
    let y = 22;

    // ── Header ──────────────────────────────────────────────────
    doc.rect(L, y, W, 46).fill(NAVY);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(16).text('NETSTAR', L+10, y+7);
    doc.fillColor(CYAN).rect(L+10, y+25, 64, 2).fill();
    doc.fillColor('#FFFFFF').font('Helvetica').fontSize(6.5).text('A SUBSIDIARY OF ALTRON', L+10, y+30);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10).text('Device Installation Sign-off', L, y+9, { width: W, align: 'right' });
    doc.fillColor('rgba(255,255,255,0.65)').font('Helvetica').fontSize(7.5)
       .text(new Date().toLocaleDateString('en-ZA', { day:'2-digit', month:'long', year:'numeric' }), L, y+23, { width: W, align: 'right' });
    y += 51;

    // ── Helpers ──────────────────────────────────────────────────
    function secHdr(title) {
      doc.rect(L, y, W, 13).fill(NAVY);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(6.5).text(title.toUpperCase(), L+6, y+3.5);
      y += 16;
    }

    function twoColDetail(pairs) {
      const cw = (W - 2) / 2;
      const rows = Math.ceil(pairs.length / 2);
      for (let i = 0; i < rows; i++) {
        const left  = pairs[i * 2];
        const right = pairs[i * 2 + 1];
        const rh = 12, shade = i % 2 === 1;
        [0, 1].forEach(col => {
          const item = col === 0 ? left : right;
          const x = col === 0 ? L : L + cw + 2;
          if (!item) return;
          if (shade) doc.rect(x, y, cw, rh).fill(LIGHT);
          doc.rect(x, y, cw, rh).stroke('#E0E2EA');
          doc.fillColor(GREY).font('Helvetica').fontSize(6.5).text(item[0], x+4, y+3, { width: cw * 0.38 });
          doc.fillColor('#111').font('Helvetica-Bold').fontSize(6.5).text(item[1]||'—', x + cw*0.4, y+3, { width: cw*0.57 });
        });
        y += rh;
      }
    }

    function preRow(label, done, shade) {
      const rh = 12;
      if (shade) doc.rect(L, y, W, rh).fill(LIGHT);
      doc.rect(L, y, W, rh).stroke('#E0E2EA');
      doc.fillColor('#111').font('Helvetica').fontSize(7).text(label, L+5, y+3, { width: W - 55 });
      const bx = L + W - 48, bw = 44, bh = 8, by = y + 2;
      const bg = done ? '#DCFCE7' : '#FEF3C7';
      const tc = done ? GREEN : AMBER;
      const txt = done ? '✓ Done' : 'Pending';
      doc.rect(bx, by, bw, bh).fill(bg);
      doc.fillColor(tc).font('Helvetica-Bold').fontSize(6.5).text(txt, bx, by+1.5, { width: bw, align: 'center' });
      y += rh;
    }

    function clTwoCol(items, dept) {
      const cw = (W - 2) / 2;
      const half = Math.ceil(items.length / 2);
      for (let i = 0; i < half; i++) {
        const rh = 12, shade = i % 2 === 1;
        const leftItem  = items[i];
        const rightItem = items[i + half];
        [leftItem, rightItem].forEach((item, col) => {
          if (!item) return;
          const x = col === 0 ? L : L + cw + 2;
          const s = data.checklist?.[dept]?.[item];
          if (shade) doc.rect(x, y, cw, rh).fill(LIGHT);
          doc.rect(x, y, cw, rh).stroke('#E0E2EA');
          doc.fillColor('#111').font('Helvetica').fontSize(6.5).text(item, x+4, y+3, { width: cw - 52 });
          const bx = x + cw - 48, bw = 44, bh = 8, by = y + 2;
          let bg, tc, txt;
          if (s === 'dn')      { bg = '#DCFCE7'; tc = GREEN;  txt = '✓ Done'; }
          else if (s === 'na') { bg = '#F0F0F5'; tc = '#888';  txt = 'N/A'; }
          else                 { bg = '#FEF3C7'; tc = AMBER;  txt = 'Pending'; }
          doc.rect(bx, by, bw, bh).fill(bg);
          doc.fillColor(tc).font('Helvetica-Bold').fontSize(6.5).text(txt, bx, by+1.5, { width: bw, align: 'center' });
        });
        y += rh;
      }
    }

    function sigRow(label, name, sigData) {
      const rh = 44;
      doc.rect(L, y, W, rh).stroke('#E0E2EA');
      doc.fillColor(GREY).font('Helvetica-Bold').fontSize(7).text(label, L+5, y+5);
      if (name) doc.fillColor('#111').font('Helvetica').fontSize(7).text(name, L+5, y+15);
      if (sigData && sigData.startsWith('data:image')) {
        try {
          const matches = sigData.match(/^data:(image\/\w+);base64,(.+)$/);
          if (matches) {
            const buf = Buffer.from(matches[2], 'base64');
            doc.image(buf, L + W * 0.3, y + 3, { fit: [W * 0.65, 38] });
          }
        } catch(e) {
          doc.fillColor('#aaa').font('Helvetica').fontSize(7).text('Signature captured', L + W*0.3, y+18);
        }
      }
      y += rh;
    }

    // ── DEPTS ────────────────────────────────────────────────────
    const DEPTS = {
      "Common (all devices)":["Office: Outlook","Teams","OneDrive","VPN","Printer","Company Portal (O365)","Intune","N-able","BitLocker enabled"],
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

    // ── Job Details ──────────────────────────────────────────────
    secHdr('Installation Details');
    twoColDetail([
      ['Technician', data.techName],       ['User', data.userName],
      ['Date', data.jobDate],              ['Contact', data.userPhone],
      ['Start time', data.startTime],      ['User email', data.userEmail],
      ['End time', data.endTime],          ['Department', data.dept],
      ['KMs to site', (data.kmTo||'—')+' km'], ['Device', data.device],
      ['KMs from site', (data.kmFrom||'—')+' km'], ['New PC name', data.newPcName],
    ]);
    if (data.notes && data.notes !== '—') {
      doc.rect(L, y, W, 12).stroke('#E0E2EA');
      doc.fillColor(GREY).font('Helvetica').fontSize(6.5).text('Notes', L+4, y+3, { width: W*0.18 });
      doc.fillColor('#111').font('Helvetica-Bold').fontSize(6.5).text(data.notes, L+W*0.2, y+3, { width: W*0.78 });
      y += 12;
    }
    y += 3;

    // ── Pre-requisites ───────────────────────────────────────────
    const preLabels = ['OneDrive backup confirmed', 'User PST files backed up', 'Device joined to Azure / Entra', 'Windows 11 compatible'];
    const cw2 = (W - 2) / 2;
    secHdr('Pre-requisites');
    for (let i = 0; i < 2; i++) {
      const shade = i % 2 === 1;
      [0, 1].forEach(col => {
        const idx = i * 2 + col;
        const x = col === 0 ? L : L + cw2 + 2;
        const lbl = preLabels[idx];
        const done = data.preChecks && data.preChecks[idx];
        if (shade) doc.rect(x, y, cw2, 12).fill(LIGHT);
        doc.rect(x, y, cw2, 12).stroke('#E0E2EA');
        doc.fillColor('#111').font('Helvetica').fontSize(6.5).text(lbl, x+4, y+3, { width: cw2 - 52 });
        const bx = x+cw2-48, bh=8, by=y+2;
        const bg = done?'#DCFCE7':'#FEF3C7', tc = done?GREEN:AMBER, txt = done?'✓ Done':'Pending';
        doc.rect(bx,by,44,bh).fill(bg);
        doc.fillColor(tc).font('Helvetica-Bold').fontSize(6.5).text(txt,bx,by+1.5,{width:44,align:'center'});
      });
      y += 12;
    }
    y += 3;

    // ── Software Checklist ───────────────────────────────────────
    secHdr('Software Installation Checklist');
    depts.forEach(dept => {
      const items = DEPTS[dept] || [];
      if (!items.length) return;
      doc.rect(L, y, W, 11).fill('#E8EAF2');
      doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(6.5).text(dept, L+5, y+3);
      y += 11;
      clTwoCol(items, dept);
      y += 2;
    });
    y += 3;

    // ── Signatures ───────────────────────────────────────────────
    secHdr('Signatures');
    const sigCw = (W - 2) / 2;
    const sigH = 48;
    // Left - Technician
    doc.rect(L, y, sigCw, sigH).stroke('#E0E2EA');
    doc.fillColor(GREY).font('Helvetica-Bold').fontSize(7).text('Technician', L+5, y+4);
    if (data.techSigName) doc.fillColor('#111').font('Helvetica').fontSize(7).text(data.techSigName, L+5, y+14);
    if (data.techSig && data.techSig.startsWith('data:image')) {
      try {
        const m = data.techSig.match(/^data:(image\/\w+);base64,(.+)$/);
        if (m) doc.image(Buffer.from(m[2],'base64'), L + sigCw*0.35, y+3, { fit: [sigCw*0.62, 42] });
      } catch(e) {}
    }
    // Right - Supervisor/User
    doc.rect(L + sigCw + 2, y, sigCw, sigH).stroke('#E0E2EA');
    doc.fillColor(GREY).font('Helvetica-Bold').fontSize(7).text('Supervisor / User', L+sigCw+7, y+4);
    if (data.supSigName) doc.fillColor('#111').font('Helvetica').fontSize(7).text(data.supSigName, L+sigCw+7, y+14);
    if (data.supSig && data.supSig.startsWith('data:image')) {
      try {
        const m = data.supSig.match(/^data:(image\/\w+);base64,(.+)$/);
        if (m) doc.image(Buffer.from(m[2],'base64'), L+sigCw+2+sigCw*0.35, y+3, { fit: [sigCw*0.62, 42] });
      } catch(e) {}
    }
    y += sigH + 3;

    // ── Footer — absolute position, never triggers new page ────
    // ── Footer ──────────────────────────────────────────────────
    // Switch to page 0 in case blank page 2 was created, draw navy bar + text
    // using _y override so PDFKit never triggers another page
    if (doc.bufferedPageRange().count > 1) doc.switchToPage(0);
    const fY = doc.page.height - 18;
    doc.save();
    doc.rect(L, fY, W, 13).fill(NAVY);
    doc.fillColor('rgba(255,255,255,0.65)').font('Helvetica').fontSize(6);
    // Override internal y pointer so text() won't push past page boundary
    doc._y = fY + 3;
    doc.page.margins.bottom = 0; // disable bottom margin check
    doc.text(
      `Netstar — A Subsidiary of Altron  ·  Signed digitally  ·  ${new Date().toLocaleDateString('en-ZA')}`,
      L + 4, fY + 3,
      { width: W - 8, align: 'center', lineBreak: false, continued: false }
    );
    doc.restore();
    doc.end();
  });
}

app.post('/send', async (req, res) => {
  const { to, toName, subject, data } = req.body;
  if (!to || !subject || !data) return res.status(400).json({ error: 'Missing required fields' });

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
    htmlContent: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:20px;">
      <div style="background:#1E3A8A;padding:18px 22px;border-radius:8px 8px 0 0;">
        <h2 style="color:#fff;margin:0;font-size:16px;">Device Installation Sign-off</h2>
        <p style="color:rgba(255,255,255,.65);margin:4px 0 0;font-size:12px;">${new Date().toLocaleDateString('en-ZA',{day:'2-digit',month:'long',year:'numeric'})}</p>
      </div>
      <div style="border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px;padding:18px 22px;">
        <p style="font-size:14px;color:#333;">Please find attached the completed sign-off report for <strong>${data.userName}</strong> (${data.dept}) dated ${data.jobDate}.</p>
        <p style="font-size:13px;color:#555;margin-top:10px;">The installation checklist has been completed and both parties have signed off digitally.</p>
        <p style="font-size:11px;color:#aaa;margin-top:18px;">Netstar — A Subsidiary of Altron &nbsp;·&nbsp; IT Department</p>
      </div>
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
