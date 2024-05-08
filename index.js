const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
require('dotenv').config()
const cors = require('cors')
const app = express()
const port = process.env.PORT || 5000;

// middleware
app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}))
app.use(express.json())
app.use(cookieParser())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ifklbg0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
// custom middleware
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  // console.log(req.method, req.url);
  if (!token) {
    return res.status(401).send({ message: 'Unauthorized' })
  }
  jwt.verify(token, process.env.TOKEN_SECRETE, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "Unauthorized access" })
    }
    req.user = decoded;
    next()
  })
}
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    const servicesCollection = client.db('carDoctorDB').collection('services')
    const bookingCollection = client.db('carDoctorDB').collection('checkout')
    // auth related api

    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.TOKEN_SECRETE, { expiresIn: '365d' })
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: true,
          sameSite: 'none'
        })
        .send({ success: true })
    })
    app.post('/logout', async (req, res) => {
      res
        .clearCookie('token', { maxAge: 0 })
        .send({ success: true })
    })
    // services related api
    app.get('/checkout', verifyToken, async (req, res) => {
      // console.log(req.user);
      // console.log(req.cookies);
      if (req.user?.email !== req.query?.email) {
        return res.status(403).send({ message: "Forbidden" })
      }
      let query = {}
      if (req.query?.email) {
        query = { email: req.query.email }
      }
      const result = await bookingCollection.find(query).toArray();
      res.send(result)
    })

    // confirm check out 
    app.post('/checkout', async (req, res) => {
      const order = req.body;
      const doc = {
        customerName: order.customerName,
        email: order.email,
        phone: order.phone,
        message: order.message,
        serviceName: order.serviceName,
        img: order.img,
        date: order.date,
        price: order.price
      }
      const result = await bookingCollection.insertOne(doc)
      res.send(result)
    })
    // get all checkout data on booking page
    app.get('/checkout', async (req, res) => {
      const result = await bookingCollection.find().toArray()
      res.send(result)
    })

    // delete a booking services
    app.delete('/checkout/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await bookingCollection.deleteOne(query)
      res.send(result)
    })

    // update status
    app.patch('/checkout/:id', async (req, res) => {
      const id = req.params.id;
      const updateStatus = req.body;
      const filter = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          status: updateStatus.status
        }
      }
      const result = await bookingCollection.updateOne(filter, updateDoc)
      res.send(result)
    })

    // services details
    app.get('/serviceDetails/:id', async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const query = { _id: new ObjectId(id) }
      const result = await servicesCollection.findOne(query)
      res.send(result)
    })

    // get dynamic services some data
    app.get('/services/:id', async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const query = { _id: new ObjectId(id) }
      const options = {
        projection: { img: 1, title: 1, price: 1 }
      }
      const result = await servicesCollection.findOne(query, options)
      res.send(result)
    })

    // get all the services
    app.get('/services', async (req, res) => {
      const query = servicesCollection.find()
      const result = await query.toArray()
      res.send(result)
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send("Car doctor server is running!");
})
app.listen(port, () => {
  console.log(`Car doctor server is running on port: ${port}`);
})