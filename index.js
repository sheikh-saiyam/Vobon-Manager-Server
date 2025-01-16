const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

const corsOptions = {
  origin: ["http://localhost:5173"],
  credentials: true,
  optionalSuccessStatus: 200,
};

// middlewares
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
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

// <-----Verify Token----->
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send({ massage: "Unauthorized Access" });
  }
  jwt.verify(token, process.env.JWT_SECRET, (error, decoded) => {
    if (error) {
      return res.status(401).send({ massage: "Unauthorized Access" });
    }
    req.user = decoded;
    next();
  });
};

async function run() {
  try {
    // <-----ALL DB & COLLECTIONS-----> \\
    const db = client.db("vobonDB");
    const usersCollection = db.collection("users");
    const couponsCollection = db.collection("coupons");
    const apartmentsCollection = db.collection("apartments");
    const announcementsCollection = db.collection("announcements");
    // <-----ALL DB & COLLECTIONS-----> \\

    // <-----JWT API's And Functionality----->

    // Cookie Options --->
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    };

    // Create Jwt Token On Successful Login Register --->
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET, {
        expiresIn: "14d",
      });
      res.cookie("token", token, cookieOptions).send({ success: true });
    });

    // Clear Token From Cookies On Logout --->
    app.post("/logout", async (req, res) => {
      res
        .clearCookie("token", { ...cookieOptions, maxAge: 0 })
        .send({ success: true });
    });

    // <-----JWT API's And Functionality----->

    // <-----Verify Admin----->
    const verifyAdmin = async (req, res, next) => {
      const email = req.user?.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      if (!user || user?.role !== "admin") {
        return res
          .status(403)
          .send({ message: "Forbidden Access! Admin Only Actions" });
      }
      next();
    };

    // <-----Verify Member----->

    // <---------- ALL CRUD FUNCTIONALITY ----------> \\

    // <----- Users Related CRUD ----->

    // Save user data in db ----->
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

    // Get user role ----->
    app.get("/user/role/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      if (email !== req.user.email) {
        return res.status(403).send({ message: "Forbidden Access" });
      }
      const result = await usersCollection.findOne(query);
      res.send({ role: result?.role });
    });

    // ADMIN ONLY -> Get all member users ----->
    app.get("/all-members", verifyToken, verifyAdmin, async (req, res) => {
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

    // Get random apartments ---->
    app.get("/explore-apartments", async (req, res) => {
      const apartments = await apartmentsCollection
        .aggregate([{ $sample: { size: 8 } }])
        .toArray();
      res.send(apartments);
    });

    // <----- Apartments CRUD ----->

    // <----- Announcements CRUD ----->

    // ADMIN ONLY -> Add new announcement in db --->
    app.post("/make-announcement", async (req, res) => {
      const announcement = req.body;
      const result = await announcementsCollection.insertOne(announcement);
      res.send(result);
    });

    // Get all announcements --->
    app.get("/announcements", verifyToken, async (req, res) => {
      const result = await announcementsCollection.find().toArray();
      res.send(result);
    });

    // <----- Announcements CRUD ----->

    // <----- Coupons CRUD ----->

    // ADMIN ONLY -> Add new coupon in db --->
    app.post("/add-coupon", async (req, res) => {
      const coupon = req.body;
      const result = await couponsCollection.insertOne(coupon);
      res.send(result);
    });

    // Get all coupons by availableCouponOnly query --->
    app.get("/coupons", async (req, res) => {
      const isOnlyAvailable = req.query.availableCouponOnly === "true";
      const option = isOnlyAvailable ? { availability: "available" } : {};
      const result = await couponsCollection.find(option).toArray();
      res.send(result);
    });

    // ADMIN ONLY -> Change coupon availability --->
    app.patch("/change-coupon-availability/:id", async (req, res) => {
      const id = req.params.id;
      const { availability } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedCoupon = {
        $set: { availability },
      };
      const result = await couponsCollection.updateOne(filter, updatedCoupon);
      res.send(result);
    });

    // <----- Coupons CRUD ----->

    // ADMIN ONLY -> Admin Stats CRUD ----->
    app.get("/admin-stats", async (req, res) => {
      const users = await usersCollection.countDocuments({ role: "user" });
      const members = await usersCollection.countDocuments({ role: "member" });
      const apartments = await apartmentsCollection.estimatedDocumentCount();
      res.send({ users, members, apartments });
    });
    // ADMIN ONLY -> Admin Stats CRUD ----->

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
