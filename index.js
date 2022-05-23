const express = require("express");
const port = process.env.PORT || 5000;
const app = express();
const cors = require("cors");
require("dotenv").config();

// MiddleWere
app.use(express.json());
app.use(cors());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.x7jic.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    await client.connect();

    // TEAM MEMBER COLLECTION
    const teamMemberCollection = client.db("tooldo").collection("team-members");

    // API"S

    // GET ALL TEAM MEMBERS
    app.get("/teamMember", async (req, res) => {
      const members = await teamMemberCollection.find({}).toArray();
      res.send(members);
    });

    // GET TEAM MEMBER BY ID
    app.get("/teamMember/:id", async (req, res) => {
      const id = req?.params?.id;
      const query = { _id: ObjectId(id) };
      const member = await teamMemberCollection.findOne(query);
      res.send(member);
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
