const express = require("express");
const port = process.env.PORT || 5000;
const app = express();
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");

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

    // TEAM MEMBER COLLECTION
    const teamMemberCollection = client.db("tooldo").collection("team-members");

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

    // Getting token ans saving users email in db
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
      const filter = { email };
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
    app.get("/item/:id", (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      // const
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
