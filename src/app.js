const express = require("express");
const bodyParser = require("body-parser");
const { sequelize } = require("./model");
const { getProfile } = require("./middleware/getProfile");
const { getContractById } = require("./controllers/getContractById");
const { getContracts } = require("./controllers/getContracts");
const { getUnpaidJobs } = require("./controllers/getUnpaidJobs");
const { createJobsPayment } = require("./controllers/createJobsPayment");
const { createDepositByUserId } = require("./controllers/createDepositByUserId")
const { bestProfession } = require("./controllers/bestProfession")
const { bestClients } = require("./controllers/bestClients")

const app = express();
app.use(bodyParser.json());
app.set("sequelize", sequelize);
app.set("models", sequelize.models);

app.get("/contracts/:id", getProfile, getContractById);

app.get("/contracts", getProfile, getContracts);

app.get("/jobs/unpaid", getProfile, getUnpaidJobs);

app.post("/jobs/:job_id/pay", getProfile, createJobsPayment);

app.post("/balances/deposit/:userId", getProfile, createDepositByUserId);

app.get("/admin/best-profession", bestProfession);

app.get("/admin/best-clients", bestClients);

module.exports = app;
