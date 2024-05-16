const express = require("express");
require("dotenv").config();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();

const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://car-doctor-project-d4515.web.app",
      "https://car-doctor-project-d4515.firebaseapp.com",
    ],
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster01.2xfw1xu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster01`;

console.log(uri);

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// middleWires
const logger = async (req, res, next) => {
  console.log("called", req.host, req.originalUrl);
  next();
};

const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;
  // console.log('token from cookies' , req?.cookies?.token);
  if (!token) {
    return res.status(401).send({ message: "unauthorized" });
  }

  jwt.verify(token, process.env.API_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized" });
    }
    req.user = decoded;
    next();
  });
};

const cookieOptions = {
  httpOnly: true,
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
  secure: process.env.NODE_ENV === "production" ? true : false,
};
async function run() {
  try {
    const servicesCollection = client.db("Car-doctor").collection("services");
    const checkoutCollection = client.db("Car-doctor").collection("checkout");

    // auth api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      console.log("user for token", user);
      const token = jwt.sign(user, process.env.API_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      console.log(token);

      res.cookie("token", token, cookieOptions).send({ token });
    });
    // setting cookies clear while user is logged out
    app.post("/logout", async (req, res) => {
      const user = req.body;
      console.log("logging out user", user);
      res.clearCookie("token", { ...cookieOptions ,maxAge: 0 }).send({ success: true });
    });

    // services apis

    app.get("/services", logger, async (req, res) => {
      const filter = req.query
      console.log(filter);
      const query = {
        // price:{
        //   // $lt:100
        //   $lte:200,
        //   // $ne:150
        //   $gt:150
        //   // $gte:150
        // }
        title: {
          $regex: filter.search,
          $options: "i"
        }
      }
      const options ={
        sort:{
          price: filter.sort === "ascending" ? 1 : -1 
        }
      }
      const cursor = servicesCollection.find(query,options);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      console.log(id);

      // finding single data by options
      const options = {
        projection: { title: 1, price: 1, service_id: 1, img: 1 },
      };
      const result = await servicesCollection.findOne(query, options);
      console.log(result);
      res.send(result);
    });
    app.get("/checkout", logger, verifyToken, async (req, res) => {
      console.log(req.query);
      let query = {};
      console.log("user of token", req.user);

      if (req.query?.email !== req.user?.email) {
        return res.status(403).send({ message: "forbidden" });
      }

      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const data = checkoutCollection.find(query);

      const result = await data.toArray();
      res.send(result);
    });

    app.post("/services", async (req, res) => {
      const data = req.body;
      console.log(data);
      const result = await servicesCollection.insertOne(data);
      res.send(result);
    });

    // checkout
    app.post("/checkout", async (req, res) => {
      const data = req.body;
      const result = await checkoutCollection.insertOne(data);
      res.send(result);
    });

    app.delete("/checkout/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await checkoutCollection.deleteOne(filter);
      res.send(result);
    });

    app.put("/checkout/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const options = { upsert: true };
      const filter = { _id: new ObjectId(id) };
      const data = req.body;
      console.log(data);
      const update = {
        $set: {
          isUpdated: data.isUpdated,
        },
      };
      const result = await checkoutCollection.updateOne(
        filter,
        update,
        options
      );
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Car Doctor");
});

app.listen(port, () => {
  console.log("port is running on:", port);
});
