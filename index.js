const express = require("express");
const port = process.env.PORT || 5000;
const app = express();
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_KEY);

// MiddleWere
app.use(express.json());
app.use(cors());

// TO VERIFY TOKEN
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send({ message: "unauthorized" });
  }
  const accessToken = authHeader.split(" ")[1];

  verify(accessToken, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const verify = require("jsonwebtoken/verify");
const { default: Stripe } = require("stripe");
const { use } = require("express/lib/application");
const { response } = require("express");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.x7jic.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    await client.connect();

    // USER COLLECTION
    const userCollection = client.db("tooldo").collection("users");

    // ITEMS COLLECTION
    const itemsCollection = client.db("tooldo").collection("items");

    // ORDERS COLLECTION
    const ordersCollection = client.db("tooldo").collection("orders");

    // TEAM MEMBER COLLECTION
    const teamMemberCollection = client.db("tooldo").collection("team-members");

    // REVIEWS COLLECTION
    const reviewsCollection = client.db("tooldo").collection("reviews");

    // INQUIRY COLLECTION
    const inquiriesCollection = client.db("tooldo").collection("inquiries");

    // Verify ADMIN
    async function verifyAdmin(req, res, next) {
      const email = req?.decoded?.email;
      const filter = { email };
      const user = await userCollection.findOne(filter);
      const role = user?.role;
      if (role === "admin") {
        next();
      } else {
        return res.status(403).send({ message: "forbidden access" });
      }
    }

    // API"S

    // Getting token and saving users email in db
    app.put("/token", async (req, res) => {
      const { userInfo } = req.body;

      const doc = {
        $set: userInfo,
      };

      const email = userInfo.email;
      const option = { upsert: true };
      const result = await userCollection.updateOne({ email }, doc, option);

      const accessToken = jwt.sign({ email }, process.env.JWT_SECRET, {
        expiresIn: "1d",
      });

      res.send({ accessToken });
    });

    // GET ALL TEAM MEMBERS
    app.get("/teamMember", async (req, res) => {
      const members = await teamMemberCollection.find({}).toArray();
      res.send(members);
    });

    // GET TEAM MEMBER BY ID
    app.get("/teamMember/:id", verifyJWT, async (req, res) => {
      const id = req?.params?.id;
      const query = { _id: ObjectId(id) };
      const member = await teamMemberCollection.findOne(query);
      res.send(member);
    });

    // CHECKING IS ADMIN OR not
    app.post("/isAdmin", async (req, res) => {
      const { email } = req.body;
      const filter = email;
      const user = await userCollection.findOne(filter);
      const result = { role: user?.role };
      res.send(result);
    });

    // GET ALL ITEMS
    app.get("/items", async (req, res) => {
      const items = await itemsCollection.find({}).toArray();
      res.send(items);
    });

    // ITEM BY ID
    app.get("/item/:id", async (req, res) => {
      const id = req?.params?.id;
      const query = { _id: ObjectId(id) };
      const item = await itemsCollection.findOne(query);
      res.send(item);
    });

    // ADD AN ORDER
    app.post("/order", verifyJWT, async (req, res) => {
      const { order } = req.body;

      const result = await ordersCollection.insertOne(order);
      const filter = { name: order.itemName };

      const item = await itemsCollection.findOne(filter);

      const orderQuantity = parseInt(order.quantity);
      const lastAvailableQuant = parseInt(item.availableQuant);
      const newAvailableQuant = lastAvailableQuant - orderQuantity;

      const doc = {
        $set: {
          availableQuant: newAvailableQuant,
        },
      };

      const updateStoke = await itemsCollection.updateOne(filter, doc);
      res.send(result);
    });

    // GET ORDERS BY EMAIL
    app.get("/orders/:email", verifyJWT, async (req, res) => {
      const email = req?.params?.email;
      const filter = { email: email };
      const orders = await ordersCollection.find(filter).toArray();
      res.send(orders);
    });

    // GET ORDER BY ID
    app.get("/order/:id", verifyJWT, async (req, res) => {
      const id = req?.params?.id;
      const filter = { _id: ObjectId(id) };
      const order = await ordersCollection.findOne(filter);

      res.send(order);
    });

    // DELETE ORDER BY ID
    app.delete("/delete", verifyJWT, async (req, res) => {
      const { order } = req.body;
      const orderId = order._id;
      const filter = { _id: ObjectId(orderId) };
      const result = await ordersCollection.deleteOne(filter);

      const filterByName = { name: order.itemName };
      const item = await itemsCollection.findOne(filterByName);

      const orderQuantity = parseInt(order.quantity);
      const lastAvailableQuant = parseInt(item.availableQuant);
      const newAvailableQuant = lastAvailableQuant + orderQuantity;

      const doc = {
        $set: {
          availableQuant: newAvailableQuant,
        },
      };

      const updateStoke = await itemsCollection.updateOne(filterByName, doc);

      res.send(result);
    });

    // CREATE-PAYMENT-INTENT
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { totalPrice } = req.body;
      const payableAmount = totalPrice * 100;

      const paymentIntents = await stripe.paymentIntents.create({
        amount: payableAmount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({ clientSecret: paymentIntents.client_secret });
    });

    // CONFIRM AN ORDER
    app.post("/confirmOrder", verifyJWT, async (req, res) => {
      const { info } = req.body;
      const id = info?.id;
      const transactionId = info.transactionId;
      const filter = { _id: ObjectId(id) };
      const doc = {
        $set: {
          transactionId: transactionId,
          paid: "true",
        },
      };
      const result = await ordersCollection.updateOne(filter, doc);
      res.send(result);
    });

    // Adding a review
    app.post("/review", verifyJWT, async (req, res) => {
      const { review } = req.body;
      const result = await reviewsCollection.insertOne(review);
      res.send(result);
    });

    // GET ALL REVIEWS
    app.get("/review", async (req, res) => {
      const result = await reviewsCollection.find({}).toArray();
      res.send(result);
    });

    // GET USER INFO BY EMAIL
    app.get("/user/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const user = await userCollection.findOne(filter);
      res.send(user);
    });

    // GET ALL USER
    app.get("/users", verifyJWT, async (req, res) => {
      const result = await userCollection.find({}).toArray();
      res.send(result);
    });

    // UPDATE USER INFO WITH ID
    app.post("/updateProfileInfo/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const { updatedInfo } = req.body;

      const updatedDoc = {
        $set: updatedInfo,
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // MAKE ADMIN BY EMAIL
    app.post("/makeAdmin", verifyJWT, verifyAdmin, async (req, res) => {
      const { userInfo } = req.body;

      const email = userInfo?.email;
      const filter = { email: email };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // ADD PRODUCT
    app.post("/addProduct", verifyJWT, verifyAdmin, async (req, res) => {
      const { product } = req.body;
      const result = await itemsCollection.insertOne(product);
      res.send(result);
    });

    // SAVE INQUIRIES TO DB
    app.post("/addInquiry", async (req, res) => {
      const { inquiry } = req.body;
      const result = await inquiriesCollection.insertOne(inquiry);
      res.send(result);
    });

    // GET ALL ORDERS
    app.get("/getOrders", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await ordersCollection.find({}).toArray();
      res.send(result);
    });

    // SETTING ORDER STATUS APPROVED
    app.get("/approve/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: "approved",
        },
      };
      const result = await ordersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // DELETE ITEM BY ID
    app.delete("/deleteItem", verifyJWT, verifyAdmin, async (req, res) => {
      const { product } = req.body;
      const productId = product._id;
      const filter = { _id: ObjectId(productId) };
      const result = await itemsCollection.deleteOne(filter);
      res.send(result);
    });
  } finally {
    // await client.close();
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello there!");
});

app.listen(port, () => {
  console.log("Responding to", port);
});
