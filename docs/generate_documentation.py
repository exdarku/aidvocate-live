"""Generate the AWS Capstone documentation .docx for AidVocate."""

from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_ALIGN_VERTICAL
from docx.oxml.ns import qn
from docx.oxml import OxmlElement


OUTPUT_PATH = "/Users/laurence/Documents/School/AWS/Capstone/AidVocate/docs/AidVocate-AWS-Capstone-Documentation.docx"


def set_cell_background(cell, color_hex):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), color_hex)
    tc_pr.append(shd)


def add_heading(doc, text, level=1):
    h = doc.add_heading(text, level=level)
    for run in h.runs:
        run.font.color.rgb = RGBColor(0x1F, 0x3A, 0x5F)
    return h


def add_paragraph(doc, text, bold=False, size=11):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.font.size = Pt(size)
    run.bold = bold
    return p


def add_bullets(doc, items):
    for item in items:
        p = doc.add_paragraph(style="List Bullet")
        if isinstance(item, tuple):
            label, body = item
            r1 = p.add_run(label)
            r1.bold = True
            p.add_run(body)
        else:
            p.add_run(item)


def add_screenshot_placeholder(doc, caption):
    """Insert a bordered placeholder box for a screenshot."""
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cell = table.cell(0, 0)
    cell.width = Inches(6.0)
    set_cell_background(cell, "F2F2F2")

    para = cell.paragraphs[0]
    para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = para.add_run("\n[ Insert screenshot here ]\n")
    run.italic = True
    run.font.size = Pt(11)
    run.font.color.rgb = RGBColor(0x66, 0x66, 0x66)

    cell.add_paragraph()
    cell.add_paragraph()

    tc_pr = cell._tc.get_or_add_tcPr()
    tc_borders = OxmlElement("w:tcBorders")
    for edge in ("top", "left", "bottom", "right"):
        b = OxmlElement(f"w:{edge}")
        b.set(qn("w:val"), "dashed")
        b.set(qn("w:sz"), "8")
        b.set(qn("w:color"), "999999")
        tc_borders.append(b)
    tc_pr.append(tc_borders)

    cap = doc.add_paragraph()
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cap_run = cap.add_run(f"Figure: {caption}")
    cap_run.italic = True
    cap_run.font.size = Pt(10)
    cap_run.font.color.rgb = RGBColor(0x55, 0x55, 0x55)
    doc.add_paragraph()


def add_service_table(doc, rows):
    table = doc.add_table(rows=1 + len(rows), cols=3)
    table.style = "Light Grid Accent 1"
    hdr = table.rows[0].cells
    hdr[0].text = "AWS Service"
    hdr[1].text = "Role in AidVocate"
    hdr[2].text = "Key Configuration"
    for cell in hdr:
        for p in cell.paragraphs:
            for r in p.runs:
                r.bold = True
    for i, (svc, role, cfg) in enumerate(rows, start=1):
        cells = table.rows[i].cells
        cells[0].text = svc
        cells[1].text = role
        cells[2].text = cfg


def main():
    doc = Document()

    for section in doc.sections:
        section.left_margin = Inches(1)
        section.right_margin = Inches(1)
        section.top_margin = Inches(1)
        section.bottom_margin = Inches(1)

    # === TITLE PAGE ===
    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    t_run = title.add_run("AidVocate")
    t_run.bold = True
    t_run.font.size = Pt(36)
    t_run.font.color.rgb = RGBColor(0x1F, 0x3A, 0x5F)

    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    s_run = subtitle.add_run("Privacy-Preserving Donation Verification Platform")
    s_run.font.size = Pt(16)
    s_run.italic = True

    doc.add_paragraph()
    doc.add_paragraph()

    capstone = doc.add_paragraph()
    capstone.alignment = WD_ALIGN_PARAGRAPH.CENTER
    c_run = capstone.add_run("AWS Cloud Deployment — Capstone Documentation")
    c_run.font.size = Pt(14)
    c_run.bold = True

    doc.add_paragraph()
    doc.add_paragraph()
    doc.add_paragraph()

    meta = doc.add_paragraph()
    meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    meta.add_run("Authors: Kharl, Laurence Lesmoras, Mc Curvin Royeras\n").font.size = Pt(12)
    meta.add_run("Services Used: Amazon EC2, Amazon S3, AWS IAM\n").font.size = Pt(12)
    meta.add_run("Date: May 2026\n").font.size = Pt(12)

    doc.add_page_break()

    # === 1. PROJECT DESCRIPTION ===
    add_heading(doc, "1. Project Description", level=1)
    add_paragraph(
        doc,
        "AidVocate is a privacy-preserving donation verification platform that allows "
        "donors to contribute to non-government organizations (NGOs) and verifiable charitable "
        "events while preserving the confidentiality of sensitive donation details. The system "
        "combines a modern web stack (React frontend, Express backend) with cryptographic "
        "verification primitives (zero-knowledge proofs and Merkle trees) so that donations "
        "can be publicly audited without exposing donor identity or exact amounts.",
    )
    add_paragraph(
        doc,
        "For this AWS Capstone, the goal is to migrate the AidVocate application from a "
        "local development environment to the AWS public cloud so that the platform is "
        "accessible over the internet. A single Amazon EC2 instance hosts both the React "
        "frontend (served by Nginx) and the Express API, while Amazon S3 is used as durable "
        "object storage for user-uploaded content such as donation receipts, NGO logos, and "
        "event photos. AWS IAM ties the two services together with an instance role that "
        "grants the EC2 server scoped access to the S3 bucket.",
    )

    add_heading(doc, "1.1 Objectives", level=2)
    add_bullets(
        doc,
        [
            "Run the full AidVocate web application (React client + Express API) on one EC2 instance.",
            "Store user-generated content (receipts, NGO logos, event photos, profile pictures) in S3.",
            "Use AWS IAM to grant the EC2 instance least-privilege access to the S3 bucket.",
            "Demonstrate a clean deployment workflow (build → SSH → restart).",
            "Verify end-to-end functionality (registration, donation, upload, verification) on the cloud.",
        ],
    )

    add_heading(doc, "1.2 Scope", level=2)
    add_paragraph(
        doc,
        "The deployment scope is limited to the AWS services required by the capstone — Amazon "
        "EC2 and Amazon S3 — plus AWS IAM for access control. Smart-contract and "
        "zero-knowledge-proof components remain part of the application logic but are not "
        "themselves AWS resources. Custom domain names, HTTPS certificates, content delivery "
        "networks, and managed databases are outside the scope of this submission.",
    )

    doc.add_page_break()

    # === 2. ARCHITECTURE EXPLANATION ===
    add_heading(doc, "2. Architecture Explanation", level=1)
    add_paragraph(
        doc,
        "The AidVocate AWS deployment uses a single-instance architecture. One Amazon EC2 "
        "instance runs both tiers of the application: Nginx serves the built React single-page "
        "application on port 80, and Node.js / Express serves the REST API on port 3001. The "
        "SQLite database file lives on the instance's EBS root volume. An Amazon S3 bucket "
        "sits alongside as durable object storage exclusively for user-uploaded content — "
        "donation receipts, NGO logos, event photos, and donor profile pictures. The EC2 "
        "server reads and writes to S3 via the AWS SDK, authenticated by an IAM instance role.",
    )

    add_heading(doc, "2.1 Architecture Diagram", level=2)
    add_screenshot_placeholder(doc, "AidVocate AWS architecture diagram (EC2 hosts app, S3 stores user uploads)")

    add_heading(doc, "2.2 Request Flow", level=2)
    add_bullets(
        doc,
        [
            ("Step 1 — ", "A user opens the AidVocate URL in their browser. The request resolves "
                          "to the EC2 instance's public IPv4 address on port 80."),
            ("Step 2 — ", "Nginx on EC2 serves the bundled index.html, JavaScript, and CSS for the "
                          "React client."),
            ("Step 3 — ", "Once loaded, the client issues XHR/fetch requests against the same "
                          "EC2 instance on port 3001, where Express handles the REST API."),
            ("Step 4 — ", "When the user uploads content (e.g., a donation receipt or NGO logo), "
                          "the Express server forwards the file to the S3 bucket using the AWS SDK "
                          "and the IAM instance role's credentials."),
            ("Step 5 — ", "When the user views uploaded content, Express returns a pre-signed S3 "
                          "URL that the browser uses to download the file directly from S3 — keeping "
                          "EC2 out of the bandwidth path for large objects."),
            ("Step 6 — ", "For donation verification, the server returns Merkle proofs / ZKP "
                          "verification status which the frontend renders on the Verify page."),
        ],
    )

    add_heading(doc, "2.3 Build & Deployment Pipeline", level=2)
    add_paragraph(
        doc,
        "The deployment is a manual SSH-based workflow appropriate for a capstone-scale project:",
    )
    add_bullets(
        doc,
        [
            ("Source — ", "Developer pushes changes to the project's git repository on GitHub."),
            ("Pull — ", "Developer SSHes into the EC2 instance and runs `git pull` inside the "
                        "project directory."),
            ("Frontend — ", "`npm run build:client` produces `client/dist/`, which Nginx serves "
                            "as the document root on port 80."),
            ("Backend — ", "`npm install --prefix server` installs dependencies, and the API is "
                           "restarted via PM2 (`pm2 restart aidvocate-api`) listening on port 3001."),
            ("S3 — ", "The bucket is created once via the AWS console and remains in place; no "
                     "redeploy is needed for static infrastructure."),
        ],
    )

    doc.add_page_break()

    # === 3. SERVICES USED ===
    add_heading(doc, "3. AWS Services Used", level=1)
    add_paragraph(
        doc,
        "The capstone uses two compute/storage services (EC2 and S3) plus AWS IAM for access "
        "management. Each is summarised below with its specific role in the AidVocate deployment.",
    )

    add_service_table(
        doc,
        [
            (
                "Amazon EC2",
                "Hosts the full AidVocate application: Nginx serving the React frontend on :80 "
                "and Express API on :3001, with the SQLite database on the EBS root volume.",
                "Instance type: t2.micro (Free Tier). AMI: Amazon Linux 2023. "
                "Security group inbound rules: SSH (22) from admin IP, HTTP (80) and "
                "API (3001) from 0.0.0.0/0.",
            ),
            (
                "Amazon S3",
                "Durable object storage for user-uploaded content — donation receipts, "
                "NGO logos, event photos, and donor profile pictures.",
                "Bucket: `aidvocate-user-content`. Block Public Access ON. Objects are "
                "served to users via short-lived pre-signed URLs generated by the API.",
            ),
            (
                "AWS IAM",
                "Manages access between the EC2 instance and the S3 bucket using an "
                "instance role attached to the EC2 server.",
                "Custom policy: `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` "
                "scoped to `aidvocate-user-content/*`. No long-lived AWS keys on the instance.",
            ),
        ],
    )

    add_heading(doc, "3.1 Amazon EC2 — Application Server", level=2)
    add_paragraph(
        doc,
        "Amazon Elastic Compute Cloud (EC2) provides the virtual server that runs the entire "
        "AidVocate application stack. A t2.micro instance running Amazon Linux 2023 was "
        "provisioned in a single Availability Zone. Node.js 18 was installed via `nvm`, the "
        "AidVocate repository was cloned, the React client was built, and Nginx was configured "
        "to serve `client/dist/` on port 80. The Express API runs under PM2 on port 3001 and "
        "talks to a local SQLite database. A security group allows SSH (22) from the developer's "
        "IP and TCP 80/3001 from anywhere so the public can reach the site.",
    )
    add_screenshot_placeholder(doc, "EC2 instance running state in the AWS console")
    add_screenshot_placeholder(doc, "EC2 security group inbound rules (22, 80, 3001)")
    add_screenshot_placeholder(doc, "Nginx + Express running on EC2 (SSH terminal)")

    add_heading(doc, "3.2 Amazon S3 — User Content Storage", level=2)
    add_paragraph(
        doc,
        "Amazon Simple Storage Service (S3) is used as durable object storage for files "
        "uploaded by users of the platform. The `aidvocate-user-content` bucket has Block "
        "Public Access enabled — objects are never world-readable. When a user uploads a "
        "donation receipt or NGO logo, the Express API on EC2 streams the file to S3 using "
        "the AWS SDK. When another user later views that content, the API issues a "
        "short-lived pre-signed URL so the browser can fetch the object directly from S3, "
        "keeping the EC2 instance out of the bandwidth path.",
    )
    add_screenshot_placeholder(doc, "S3 bucket overview showing user-uploaded content folders")
    add_screenshot_placeholder(doc, "S3 bucket permissions — Block Public Access enabled")
    add_screenshot_placeholder(doc, "Pre-signed URL working in the browser")

    add_heading(doc, "3.3 AWS IAM — Access Control", level=2)
    add_paragraph(
        doc,
        "AWS Identity and Access Management (IAM) enforces the principle of least privilege "
        "for the link between EC2 and S3. Instead of placing long-lived AWS access keys on "
        "the EC2 instance, an IAM role is attached to the instance at launch. The role has a "
        "single inline policy granting `s3:PutObject`, `s3:GetObject`, and `s3:DeleteObject` "
        "scoped to the AidVocate user-content bucket and nothing else. The AWS SDK on EC2 "
        "automatically picks up the role's temporary credentials from instance metadata.",
    )
    add_screenshot_placeholder(doc, "IAM role attached to the EC2 instance")
    add_screenshot_placeholder(doc, "IAM policy JSON scoped to the user-content bucket")

    doc.add_page_break()

    # === 4. IMPLEMENTATION ===
    add_heading(doc, "4. Implementation Steps", level=1)

    add_heading(doc, "4.1 Provisioning the EC2 Instance", level=2)
    add_bullets(
        doc,
        [
            "Open EC2 console → Launch Instance.",
            "Name the instance `aidvocate-app`, choose Amazon Linux 2023 AMI, t2.micro.",
            "Create a new key pair (`aidvocate-key.pem`) and download it.",
            "Create a security group `aidvocate-sg` with SSH (22) from My IP, TCP 80 from anywhere, TCP 3001 from anywhere.",
            "Attach the `aidvocate-ec2-role` IAM role (created in §4.3) at launch.",
            "Launch the instance and wait for the status to become Running.",
            "SSH in with `ssh -i aidvocate-key.pem ec2-user@<public-ip>`.",
            "Install Node.js 18 and Nginx, clone the repo, build the client, install server deps.",
            "Configure Nginx to serve `client/dist/` and start the API with PM2.",
        ],
    )
    add_screenshot_placeholder(doc, "EC2 launch wizard — instance type and AMI selection")
    add_screenshot_placeholder(doc, "EC2 instance details — public IPv4 address visible")

    add_heading(doc, "4.2 Configuring the S3 Bucket", level=2)
    add_bullets(
        doc,
        [
            "Open S3 console → Create bucket → name it `aidvocate-user-content`.",
            "Leave \"Block all public access\" CHECKED — uploads stay private.",
            "Pick the same region as the EC2 instance (e.g., ap-east-1).",
            "Enable versioning (optional) so accidental overwrites can be recovered.",
            "Create folder-style prefixes for organisation: `receipts/`, `ngo-logos/`, `event-photos/`, `profile-pics/`.",
            "Note the bucket ARN — it will be referenced by the IAM policy in §4.3.",
        ],
    )
    add_screenshot_placeholder(doc, "S3 bucket creation wizard with Block Public Access enabled")
    add_screenshot_placeholder(doc, "S3 bucket showing folder prefixes for each content type")

    add_heading(doc, "4.3 IAM Instance Role", level=2)
    add_bullets(
        doc,
        [
            "Open IAM console → Roles → Create role.",
            "Trusted entity: AWS service → EC2.",
            "Create a customer-managed policy with `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on `arn:aws:s3:::aidvocate-user-content/*`.",
            "Attach the policy to the new role, name it `aidvocate-ec2-role`.",
            "From the EC2 console, attach the role to the running instance (Actions → Security → Modify IAM role).",
        ],
    )
    add_screenshot_placeholder(doc, "IAM policy JSON scoped to the AidVocate user-content bucket")
    add_screenshot_placeholder(doc, "EC2 instance with the IAM role attached")

    add_heading(doc, "4.4 Wiring Application to S3", level=2)
    add_paragraph(
        doc,
        "Server-side, the Express API uses the AWS SDK for JavaScript (v3). Because the "
        "instance has the IAM role attached, no AWS access keys are placed in `.env`; the SDK "
        "discovers credentials automatically. Upload endpoints accept multipart form data, "
        "stream the file into `s3.putObject`, and store the resulting object key in SQLite. "
        "Read endpoints generate pre-signed GET URLs (expiring in 15 minutes) and return them "
        "to the React client, which renders the resource from the S3 URL directly.",
    )
    add_screenshot_placeholder(doc, "Code snippet — Express upload route streaming to S3")
    add_screenshot_placeholder(doc, "Browser DevTools — pre-signed URL fetching an image from S3")

    add_heading(doc, "4.5 End-to-End Verification", level=2)
    add_bullets(
        doc,
        [
            "Open the EC2 public URL in a browser → AidVocate homepage renders.",
            "Register a new donor account and log in; profile picture upload lands in S3.",
            "Submit a donation; the success page renders the generated receipt PDF from S3.",
            "Browse the NGO list — NGO logos render via pre-signed S3 URLs.",
            "Verify a donation using the Verify page — Merkle / ZKP check returns success.",
            "Check EC2 logs over SSH and the S3 bucket contents to confirm the round trip.",
        ],
    )
    add_screenshot_placeholder(doc, "AidVocate dashboard after successful login (EC2)")
    add_screenshot_placeholder(doc, "Profile picture rendered from S3 in the UI")
    add_screenshot_placeholder(doc, "S3 bucket showing the newly uploaded file")
    add_screenshot_placeholder(doc, "Donation verification page returning a valid proof")

    doc.add_page_break()

    # === 5. SECURITY & COST ===
    add_heading(doc, "5. Security and Cost Considerations", level=1)

    add_heading(doc, "5.1 Security", level=2)
    add_bullets(
        doc,
        [
            "EC2 SSH access is restricted to a single administrative IP via the security group.",
            "The S3 bucket has Block Public Access enabled — content is never world-readable.",
            "User content is exposed only through short-lived pre-signed URLs.",
            "IAM follows least privilege: the EC2 role can only act on the AidVocate bucket.",
            "No long-lived AWS access keys live on the EC2 instance — credentials are provided "
            "via the instance metadata service.",
            "Application-level secrets (JWT_SECRET, RPC keys) live in `.env` on the EC2 instance, "
            "excluded from git via `.gitignore`.",
        ],
    )

    add_heading(doc, "5.2 Cost", level=2)
    add_paragraph(
        doc,
        "Both services are used within the AWS Free Tier for the duration of the capstone. "
        "The t2.micro instance falls under 750 monthly hours of Free Tier compute, and the "
        "user-uploaded files stored in S3 (well under 5 GB during testing) and their "
        "associated PUT/GET requests fit comfortably within Free Tier limits.",
    )

    # === 6. CONCLUSION ===
    add_heading(doc, "6. Conclusion", level=1)
    add_paragraph(
        doc,
        "Deploying AidVocate on AWS using EC2 and S3 demonstrates a pragmatic, single-instance "
        "architecture appropriate for an early-stage product. Amazon EC2 runs the entire "
        "application stack — frontend, backend, and database — while Amazon S3 provides durable, "
        "scalable storage for user-uploaded content without enlarging the EC2 disk footprint. "
        "AWS IAM keeps the link between the two services secure by replacing static access keys "
        "with an instance role scoped to a single bucket. This deployment satisfies the AWS "
        "Capstone requirements and leaves a clear runway for future enhancements such as "
        "CloudFront in front of S3, RDS for a managed database, and an Application Load "
        "Balancer for horizontal scaling.",
    )

    doc.save(OUTPUT_PATH)
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
