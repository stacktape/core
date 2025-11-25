# Stacktape: Still your AWS, but 97% easier

## What is Stacktape?

- Stacktape is a PaaS 2.0 that deploys to your own AWS account
- Can deploy containers, Lambdas, RDS, Redis & 30+ other services
- Risk-free: users can extend, override or eject from using Stacktape at anytime
- Users can go from scratch to production-grade AWS infra in a day. No DevOps knowledge required
- Stacktape combines the power and flexibility of AWS with a radically simplified developer experience.

---

## The Problem Stacktape Solves

### The Old Way

- **Traditional PaaS:**
  - Limited in what and where you can deploy
  - Up to 8x more expensive, with surprise bills (especially for data egress)
  - Advanced features (like private networking) only on expensive tiers
  - One unsupported use-case can force a migration to AWS anyway

- **In-House DevOps:**
  - Hundreds or thousands of hours spent configuring IaC, CI/CD, and deployment scripts
  - Weeks to months to get production-ready
  - Developer productivity suffers — as developers can't deploy using self-service
  - Maintenance, upgrades, and fixes are a full-time job

### The Stacktape Way

- Supports **any frontend or backend app**
- Delivers **well-architected, battle-tested AWS infrastructure from day 1**
- **Cost-optimized** with transparent pricing
- Handles advanced use-cases without breaking the bank—scales with you
- **First production-grade deployment in 24 hours**
- **Significantly improves development velocity**—developers can deploy by themselves
- Maintained by AWS experts, with **8-minute average support response time**

---

## How Stacktape Works

### 1. **Infrastructure as Code, Reimagined**

- **Start with a Preset:** Generate the backbone of your configuration for any use-case.
- **Configuration GUI:** Fill in details using a simple, intuitive interface.
- **IntelliSense:** Advanced properties are accessible with autocomplete and built-in docs.
- **Price Estimation:** See estimated AWS costs as you type.
- **Full Control:** Override or extend everything as needed.

### 2. **Flexible Deployment**

- Deploy to any number of AWS accounts (dev, staging, prod, or customer accounts)
- Choose your preferred deployment method — CLI, GUI, or API

### 3. **Internal Developer Platform**

Stacktape provides a fully-featured platform for modern teams:

- **Logs & Metrics:** Access logs and metrics from containers, lambda functions, databases, load balancers, and more.
- **Private Networking & VPC:** Secure your services and databases, use bastion hosts for management.
- **Shell Access:** Securely connect to running containers for debugging and management.
- **Dev Mode:** Run lambda functions and containers in development mode—no redeploys needed.
- **Alarms:** Get notified of unexpected events, with alerts to Slack, MS Teams, or email.
- **Automatic Packaging:** Build containers and lambda functions from source using Stacktape buildpacks, Nixpacks,
  Paketo, or your own Dockerfile.
- **Cost Explorer:** Detailed cost breakdowns for every stack, across multiple AWS accounts.
- **Scripts & Hooks:** Create reusable scripts for migrations, tests, etc., and run them as hooks or commands.
- **Secrets Management:** Manage secrets from the Stacktape console and reference them in your config.
- **Organization Activity:** See all changes your team makes, with corresponding logs.

---

## What Stacktape Offers to Users

### For Developers

- **Self-service deployments**—no more waiting for DevOps
- **Battle-tested AWS best practices** out of the box
- **Rapid iteration** with dev mode and instant feedback
- **Advanced use-cases** supported without vendor lock-in

### For Businesses

- **Dramatic cost savings** compared to traditional PaaS or in-house DevOps
- **Faster time-to-market**—production-ready in 24 hours
- **Enterprise-grade security** and compliance (SOC 2 Type II available)
- **Scales with your business**—from side projects to complex, multi-team organizations
- **Premium support** with industry-leading response times

---

### Supported AWS Infrastructure Resources

**Serverless:**

- Lambda Functions (including Edge Lambda)
- DynamoDB Tables
- Aurora Serverless
- HTTP API Gateway
- S3 Buckets
- EventBridge, Step Functions, SQS, SNS
- Cognito User Pools

**Container-Based:**

- Web Services (ECS Fargate)
- Worker Services
- Batch Jobs
- Private Services
- Auto-scaling configurations

**Databases & Storage:**

- SQL Databases (RDS & Aurora)
- Redis Clusters
- OpenSearch (Elasticsearch)
- MongoDB Atlas integration
- Upstash Redis & Kafka

**Frontend Hosting:**

- Serverless Next.js (OpenNext architecture)
- Single Page Applications with CDN
- Static sites with global distribution

## Pricing & Business Model

Stacktape offers a transparent, usage-based pricing model:

- **Free Tier:**
  - $0/month
  - Most platform features
  - 1 team member
  - Up to $100/mo AWS costs
  - 2 weeks free premium support

- **Flexible Tier:**
  - Pay a percentage of your AWS costs (starting at 30%, decreasing with higher usage)
  - All platform features
  - Unlimited team members and deployments
  - Up to 24x7 dedicated support

- **Enterprise Tier:**
  - Custom pricing
  - SLA, self-hostable platform, SOC 2 Type II, 24x7 on-call support

**Example Savings:**

- Typical infrastructure:
  - Before: ~$750/mo (traditional PaaS)
  - After: ~$325/mo ($250 AWS + $75 Stacktape fee) — _Save ~60%_
- Complex infrastructure:
  - Before: ~$12,000/mo (in-house DevOps)
  - After: ~$2,560/mo ($2k AWS + $560 Stacktape fee) — _Save ~80%_

---

## Target Markets & Customer Segments

Geography: US, UK, EU, NZ, Australia

Tech stack: usually Node.js, Python, PHP

**Startups**

- Want or need to use AWS but don't have experience to manage it themselves
- They know that hiring DevOps experts is hard
- Examples: Trigger.dev (Series A), Receipts (seed stage), Lastmyle (pre-seed)
- 5-25 employees

**Development Agencies**

- Manage multiple client projects
- Typically used a platform such as DigitalOcean but now require features and reliability of AWS, but don't want to go
  through struggle to manage the complexity of AWS
- 5-50 employees

**Competitors**

- Heroku
- Render
- Flightcontrol.dev
- Railway
- Fly.io
- Porter.run
- AWS Elastic Beanstalk
- AWS LightSail
- Vercel
