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
