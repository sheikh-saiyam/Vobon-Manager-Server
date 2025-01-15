const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

// middlewares
app.use(cors());
app.use(express.json());
// middlewares

// MongoDB Setup ----->
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.83eiz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// custom client code for connecting to DB
const client = new MongoClient(uri, {
  tls: true,
  serverSelectionTimeoutMS: 3000,
  autoSelectFamily: false,
});
// custom client code for connecting to DB

async function run() {
  try {
    // <-----ALL DB & COLLECTIONS-----> \\
    const db = client.db("vobonDB");
    const usersCollection = db.collection("users");
    const couponsCollection = db.collection("coupons");
    const apartmentsCollection = db.collection("apartments");
    const announcementsCollection = db.collection("announcements");
    // <-----ALL DB & COLLECTIONS-----> \\

    // <---------- ALL CRUD FUNCTIONALITY ----------> \\

    // <----- Users Related CRUD ----->

    // save user data in db ----->
    app.post("/users", async (req, res) => {
      const user = req.body;
      // check if user is already exists--->
      const query = { email: user.email };
      const isExist = await usersCollection.findOne(query);
      if (isExist) {
        return res.send(isExist);
      }
      // if new user save data in db --->
      const result = await usersCollection.insertOne({ ...user, role: "user" });
      res.send(result);
    });

    // get user role ----->
    app.get("/user/role/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await usersCollection.findOne(query);
      res.send({ role: result?.role });
    });

    // get all member users ----->
    app.get("/all-members", async (req, res) => {
      const result = await usersCollection
        .find({
          role: "member",
        })
        .toArray();
      res.send(result);
    });

    // <----- Users Related CRUD ----->

    // <----- Apartments CRUD ----->

    // Get all apartments ----->
    app.get("/apartments", async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const skip = (page - 1) * 6;

      const apartments = await apartmentsCollection
        .find()
        .skip(skip)
        .limit(6)
        .toArray();

      const totalApartments = await apartmentsCollection.countDocuments();
      const totalPages = Math.ceil(totalApartments / 6);

      res.send({
        apartments,
        totalPages,
      });
    });

    // <----- Apartments CRUD ----->

    // <----- Announcements CRUD ----->

    // Add new announcement in db --->
    app.post("/make-announcement", async (req, res) => {
      const announcement = req.body;
      const result = await announcementsCollection.insertOne(announcement);
      res.send(result);
    });

    // Get all announcements --->
    app.get("/announcements", async (req, res) => {
      const result = await announcementsCollection.find().toArray();
      res.send(result);
    });

    // <----- Announcements CRUD ----->

    // <----- Coupons CRUD ----->

    // Add new coupon in db --->
    app.post("/add-coupon", async (req, res) => {
      const coupon = req.body;
      const result = await couponsCollection.insertOne(coupon);
      res.send(result);
    });

    // Get all coupons --->
    app.get("/coupons", async (req, res) => {
      const result = await couponsCollection.find().toArray();
      res.send(result);
    });

    // <----- Coupons CRUD ----->

    // <---------- ALL CRUD FUNCTIONALITY ----------> \\

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } catch (error) {
    console.log("Error caught-->", error);
  }
}

run().catch(console.dir);
// MongoDB Setup ----->

app.get("/", (req, res) => {
  res.send("ph-b10-assignment12 Server Is Running");
});

app.listen(port, () => {
  console.log(`ph-b10-assignment12 Server Is Running On Port: ${port}`);
});
