const express = require("express");
require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);

const app = express();

// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  const token = authorization.split(" ")[1];
  if (!token) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

app.get("/", (req, res) => {
  res.send("TalkTrove server is running");
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dgzmwwl.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    //await client.connect();

    app.post("/jwt", (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send(token);
    });

    const classCollection = client
      .db("TalkTrovesDB")
      .collection("classCollection");
    const userCollection = client
      .db("TalkTrovesDB")
      .collection("usersCollection");
    const studentFeedbackCollection = client
      .db("TalkTrovesDB")
      .collection("studentsFeedbackCollection");
    const selectedClassCollection = client
      .db("TalkTrovesDB")
      .collection("selectedClassCollection");
    const enrolledClassesCollection = client
      .db("TalkTrovesDB")
      .collection("enrolledClassesCollection");

    // create payment intent
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      if (price) {
        const amount = parseFloat(price) * 100;
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });
        res.send({ clientSecret: paymentIntent.client_secret });
      }
    });

    // admin api
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(401)
          .send({ error: true, message: "forbidden access" });
      }
      next();
    };

    // check admin
    app.get("/users/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const { email } = req.params;
      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { admin: user.role === "admin" };
      res.send(result);
    });

    // instructor api
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "instructor") {
        return res
          .status(401)
          .send({ error: true, message: "forbidden access" });
      }
      next();
    };

    // check instructor
    app.get(
      "/users/instructor/:email",
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        const { email } = req.params;
        if (req.decoded.email !== email) {
          res.send({ instructor: false });
        }
        const query = { email: email };
        const user = await userCollection.findOne(query);
        const result = { instructor: user.role === "instructor" };
        res.send(result);
      }
    );

    // get instructor add classes for my classes page : instructor
    app.get(
      "/classes/instructor/:email",
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        const email = req.params;
        const query = email;
        const result = await classCollection.find(query).toArray();
        res.send(result);
      }
    );

    // instructor class posts : instructor
    app.post(
      "/classes/instructor",
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        const classInfo = req.body;
        const result = await classCollection.insertOne(classInfo);
        res.send(result);
      }
    );
    // get all classes for manage classes : admin
    app.get("/allClasses/admin", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    });

    //get users
    app.get("/users/:email", async (req, res) => {
      const email = req.params;
      const query = email;
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    // get all users for manage users : admin
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // add user
    app.put("/users/:email", async (req, res) => {
      const { email } = req.params;
      const newUser = req.body;
      const query = { email: email };

      const user = await userCollection.findOne(query);
      if (!user) {
        newUser.role = "student";
      }
      const options = { upsert: true };
      const updatedDoc = {
        $set: newUser,
      };
      const result = await userCollection.updateOne(query, updatedDoc, options);
      res.send(result);
    });

    // get update user role : admin
    app.patch("/users/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const { id } = req.params;
      const filter = { _id: new ObjectId(id) };
      const { role } = req.body;
      if (role === "instructor") {
        const updateInfo = {
          $set: { role: role, students: 0 },
        };
        const result = await userCollection.updateOne(filter, updateInfo);
        res.send(result);
      } else {
        const updateInfo = {
          $set: { role: role },
        };
        const result = await userCollection.updateOne(filter, updateInfo);
        res.send(result);
      }
    });

    // classes for home page
    app.get("/classes", async (req, res) => {
      const query = { status: "approved" };
      const result = await classCollection
        .find(query)
        .sort({ enrolledStudents: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    // get all approved classes
    app.get("/allClasses", async (req, res) => {
      const query = { status: "approved" };
      const result = await classCollection.find(query).toArray();
      res.send(result);
    });

    // get user specific classes : students
    app.get("/classes/:email", verifyJWT, async (req, res) => {
      const {email} = req.params;
      const query = { userEmail: email };
      const result = await selectedClassCollection.find(query).toArray();
      res.send(result);
    });

    // select classes : students
    app.post("/classes", verifyJWT, async (req, res) => {
      const info = req.body;
      const result = await selectedClassCollection.insertOne(info);
      res.send(result);
    });

    app.put("/classes/:id", verifyJWT, verifyInstructor, async (req, res) => {
      const { id } = req.params;
      const filter = { _id: new ObjectId(id) };
      const info = req.body;
      const updatedClassInfo = {
        $set: {
          image: info?.image,
          className: info.className,
          price: info?.price,
          seats: info?.seats,
          date: info?.date,
        },
      };
      const result = await classCollection.updateOne(filter, updatedClassInfo);
      res.send(result);
    });

    // confirm payment to enrolled : students
    app.post("/enroll/:id", verifyJWT, async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const info = req.body;
      const filterInstructor = { email: info.email };
      const result = await classCollection.updateOne(query, {
        $inc: { enrolledStudents: 1, seats: -1 },
      });
      if (result.modifiedCount > 0) {
        await selectedClassCollection.deleteOne({ classId: id });
        await enrolledClassesCollection.insertOne(info);
        await userCollection.updateOne(filterInstructor, {
          $inc: { students: 1 },
        });
      }

      res.send(result);
    });

    // update class status : admin
    app.patch("/classes/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const { id } = req.params;
      const filter = { _id: new ObjectId(id) };
      const { status } = req.body;
      const updateInfo = {
        $set: { status: status },
      };
      const result = await classCollection.updateOne(filter, updateInfo);
      res.send(result);
    });

    // add feedback for admin : admin
    app.patch(
      "/classes/admin/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const { id } = req.params;
        const filter = { _id: new ObjectId(id) };
        const { feedback } = req.body;
        const addFeedback = {
          $set: { feedback },
        };
        const result = await classCollection.updateOne(filter, addFeedback);
        res.send(result);
      }
    );

    // delete selected class : student
    app.delete("/classes/:id", verifyJWT, async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const result = await selectedClassCollection.deleteOne(query);
      res.send(result);
    });

    //get enrolled classes for specific students : students
    app.get("/enrolledClasses/:email", verifyJWT, async (req, res) => {
      const { email } = req.params;
      const query = { userEmail: email };
      const result = await enrolledClassesCollection.find(query).toArray();
      res.send(result);
    });

    // payment history
    app.get("/paymentHistory/:email", verifyJWT, async (req, res) => {
      const { email } = req.params;
      const query = { userEmail: email };
      const result = await enrolledClassesCollection.find(query).sort({date:1}).toArray();
      res.send(result);
    });

    // instructors api
    app.get("/instructors", async (req, res) => {
      const query = { role: "instructor" };
      const result = await userCollection
        .find(query)
        .sort({ students: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    app.get("/allInstructors", async (req, res) => {
      const query = { role: "instructor" };
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/studentFeedback", async (req, res) => {
      const result = await studentFeedbackCollection.find().toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
