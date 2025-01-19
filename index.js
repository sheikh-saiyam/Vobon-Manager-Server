const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

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
    const paymentsCollection = db.collection("payments");
    const apartmentsCollection = db.collection("apartments");
    const agreementsCollection = db.collection("agreements");
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
    const verifyMember = async (req, res, next) => {
      const email = req.user?.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      if (!user || user?.role !== "member") {
        return res
          .status(403)
          .send({ message: "Forbidden Access! Member Only Actions" });
      }
      next();
    };

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

    // ADMIN ONLY -> Change Member Role to User ----->
    app.patch(
      "/change-member-role/:email",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const email = req.params.email;
        const filter = { email };
        const updatedRole = {
          $set: { role: "user" },
        };
        const result = await usersCollection.updateOne(filter, updatedRole);
        res.send(result);
      }
    );

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

    app.get("/all-apartments", async (req, res) => {
      const result = await apartmentsCollection.find().toArray();
      res.send(result);
    });

    // Get random apartments ---->
    app.get("/explore-apartments", async (req, res) => {
      const apartments = await apartmentsCollection
        .aggregate([{ $sample: { size: 8 } }])
        .toArray();
      res.send(apartments);
    });

    // <----- Apartments CRUD ----->

    // <----- Agreements CRUD ----->

    // Add new agreement in db --->
    app.post("/make-agreement-request", verifyToken, async (req, res) => {
      const agreement = req.body;
      // check if user already had an agreement-request --->
      const query = { "user_details.email": agreement.user_details.email };
      const userAgreementExists = await agreementsCollection.findOne(query);
      if (userAgreementExists) {
        return res.send({
          title: "Action not permitted",
          message:
            "You already have an agreement. Each user is allowed to agreement for only one apartment",
        });
      }
      // if user not had an agreement-request then save in db --->
      const result = await agreementsCollection.insertOne(agreement);
      res.send(result);
    });

    // ADMIN ONLY -> Get all pending agreement requests --->
    app.get(
      "/all-agreement-requests",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const result = await agreementsCollection
          .find({
            agreement_status: "pending",
          })
          .toArray();
        res.send(result);
      }
    );

    // ADMIN ONLY -> Accept Agreement Request --->
    app.patch(
      "/accept-agreement-request/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        // Get required data from req --->
        const id = req.params.id;
        const { user_email, apartment_id } = req.body;

        // 1. update agreement status to checked --->
        const agreementFilter = { _id: new ObjectId(id) };
        const updatedAgreementStatus = {
          $set: {
            agreement_status: "checked",
            agreement_accept_date: new Date(),
          },
        };
        const agreementResult = await agreementsCollection.updateOne(
          agreementFilter,
          updatedAgreementStatus
        );

        // 2. update user role to member --->
        const query = { email: user_email };
        const updatedRole = {
          $set: {
            role: "member",
          },
        };
        const roleResult = await usersCollection.updateOne(query, updatedRole);

        // 3. update apartment status to rented --->
        const apartmentFilter = { _id: new ObjectId(apartment_id) };
        const updatedApartmentStatus = {
          $set: {
            status: "rented",
          },
        };
        const apartmentResult = await apartmentsCollection.updateOne(
          apartmentFilter,
          updatedApartmentStatus
        );

        res.send({ agreementResult, roleResult, apartmentResult });
      }
    );

    // ADMIN ONLY -> Reject Agreement Request --->
    app.patch(
      "/reject-agreement-request/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        // update agreement status to checked --->
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedAgreementStatus = {
          $set: {
            agreement_status: "rejected",
            agreement_reject_date: new Date(),
          },
        };
        const result = await agreementsCollection.updateOne(
          filter,
          updatedAgreementStatus
        );
        res.send(result);
      }
    );

    // MEMBER ONLY -> Get agreement based on member email --->
    app.get(
      "/my-agreement/:email",
      verifyToken,
      verifyMember,
      async (req, res) => {
        const email = req.params.email;
        // email verification --->
        if (email !== req.user.email) {
          return res.status(403).send({ message: "Forbidden Access" });
        }
        const query = { "user_details.email": email };
        const result = await agreementsCollection.findOne({
          ...query,
          agreement_status: "checked",
        });
        res.send(result);
      }
    );

    // <----- Agreements CRUD ----->

    // <----- Announcements CRUD ----->

    // ADMIN ONLY -> Add new announcement in db --->
    app.post(
      "/make-announcement",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const announcement = req.body;
        const result = await announcementsCollection.insertOne(announcement);
        res.send(result);
      }
    );

    // Get all announcements --->
    app.get("/announcements", verifyToken, async (req, res) => {
      const result = await announcementsCollection.find().toArray();
      res.send(result);
    });

    // <----- Announcements CRUD ----->

    // <----- Coupons CRUD ----->

    // ADMIN ONLY -> Add new coupon in db --->
    app.post("/add-coupon", verifyToken, verifyAdmin, async (req, res) => {
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
    app.patch(
      "/change-coupon-availability/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const { availability } = req.body;
        const filter = { _id: new ObjectId(id) };
        const updatedCoupon = {
          $set: { availability },
        };
        const result = await couponsCollection.updateOne(filter, updatedCoupon);
        res.send(result);
      }
    );

    // <----- Coupons CRUD ----->

    // <----- Payment Functionality & CRUD ----->

    // Create A PaymentIntent --->
    app.post("/create-payment-intent", verifyToken, async (req, res) => {
      // Get the price --->
      const { rentPrice } = req.body;
      // Calculate the price in cent --->
      const price = rentPrice * 100;

      // Create a PaymentIntent with the order amount and currency --->
      const { client_secret } = await stripe.paymentIntents.create({
        amount: price,
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
      });

      res.send({ clientSecret: client_secret });
    });

    // Save new payment information in db --->
    app.post(
      "/save-payment-information",
      verifyToken,
      verifyMember,
      async (req, res) => {
        const payment_information = req.body;
        const result = await paymentsCollection.insertOne(payment_information);
        res.send(result);
      }
    );

    // Get all payments based on member_email --->
    app.get(
      "/my-payment-history/:email",
      verifyToken,
      verifyMember,
      async (req, res) => {
        const email = req.params.email;
        const query = { member_email: email };
        // email verification --->
        if (email !== req.user.email) {
          return res.status(403).send({ message: "Forbidden Access" });
        }
        const result = await paymentsCollection.find(query).toArray();
        res.send(result);
      }
    );

    // <----- Payment Functionality & CRUD ----->

    // ADMIN ONLY -> Admin Stats CRUD ----->
    app.get("/admin-stats", verifyToken, verifyAdmin, async (req, res) => {
      const users = await usersCollection.countDocuments({ role: "user" });
      const members = await usersCollection.countDocuments({ role: "member" });
      const apartments = await apartmentsCollection.estimatedDocumentCount();
      // Get available & agreement apartments in % --->
      const availableApartments = await apartmentsCollection.countDocuments({
        status: "available",
      });
      const agreementApartments = await apartmentsCollection.countDocuments({
        status: "rented",
      });
      const availablePercentage = (availableApartments / apartments) * 100;
      const agreementPercentage = (agreementApartments / apartments) * 100;
      res.send({
        users,
        members,
        apartments,
        available_apartments: availableApartments,
        agreement_apartments: agreementApartments,
        availablePercentage: Math.round(availablePercentage.toFixed(0)),
        agreementPercentage: Math.round(agreementPercentage.toFixed(0)),
      });
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
