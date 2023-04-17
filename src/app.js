import express from "express"
import cors from "cors"
import { MongoClient } from "mongodb"
import dotenv from "dotenv"
import Joi from "joi";
import dayjs from "dayjs";
const app = express()


app.use(express.json())
app.use(cors())
dotenv.config()


let db
const mongoClient = new MongoClient(process.env.DATABASE_URL)
mongoClient.connect()
    .then(() => db = mongoClient.db())
    .catch((err) => console.log(err.message))


const participantSchema = Joi.object({
    name: Joi.string().trim().required(),
});
app.post("/participants", async (req, res) => {
    const { error, value } = participantSchema.validate(req.body);

    if (error) {
        return res.status(422).send();
    }
    const participants = db.collection("participants");
    const participant = await participants.findOne({ name: value.name });

    if (participant) {
        return res.status(409).send();
    }

    const newParticipant = {
        name: value.name,
        lastStatus: Date.now(),
    };

    await participants.insertOne(newParticipant);

    const messages = db.collection("messages");
    const message = {
        from: value.name,
        to: "Todos",
        text: "entra na sala...",
        type: "status",
        time: dayjs().format("HH:mm:ss"),
    };

    await messages.insertOne(message);

    return res.status(201).send();
});

app.get('/participants', async (req, res) => {
    try {
        const participants = await db.collection('participants').find().toArray();
        if (participants.length > 0) {
            res.json(participants);
        } else {
            res.json([]);
        }
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Erro ao buscar participantes' });
    }
});

app.post('/messages', async (req, res) => {
    const { to, text, type } = req.body;
    const from = req.header('User');
    const schema = Joi.object({
        to: Joi.string().required(),
        text: Joi.string().required(),
        type: Joi.string().valid('message', 'private_message').required()
    });
    const { error } = schema.validate({ to, text, type });
    if (error) return res.status(422).end();
    const participant = await db.collection('participants').findOne({ name: from });
    if (!participant) return res.status(422).end();


    const time = dayjs().format('HH:mm:ss');
    const message = { from, to, text, type, time };

    await db.collection('messages').insertOne(message);

    res.status(201).end();
});


app.get('/messages', async (req, res) => {
    const user = req.header('User');
  
    const conditions = {
      $or: [
        { type: 'message', to: 'Todos' },
        { type: 'private_message', $or: [{ to: user }, { from: user }] }
      ]
    };
  
    let limit = req.query.limit || 0;
    if (isNaN(limit) || limit <= 0) {
      return res.status(422).send({ error: 'Invalid limit parameter' });
    }
    const messages = await Message.find(conditions).sort({ time: -1 }).limit(parseInt(limit));
  
    res.send(messages);
  });

  app.post("/status", async (req, res) => {
    const userName = req.header('User');
    if (!userName) {
      return res.status(404).send();
    }
    const participants = db.collection("participants");
    const participant = await participants.findOne({ name: userName });
    if (!participant) {
      return res.status(404).send();
    }
    await participants.updateOne({ name: userName }, { $set: { lastStatus: Date.now() } });
    res.status(200).send();
  });
  
  setInterval(async () => {
    const participants = await db.collection("participants").find().toArray();
    const messages = db.collection("messages");
    const time = Date.now() - 10000;
    const removedParticipants = participants.filter((participant) => participant.lastStatus < time);
    removedParticipants.forEach(async (participant) => {
      await messages.insertOne({
        from: participant.name,
        to: "Todos",
        text: "sai da sala...",
        type: "status",
        time: dayjs().format("HH:mm:ss"),
      });
    });
    await db.collection("participants").deleteMany({ lastStatus: { $lt: time } });
  }, 15000);

  
const PORT = 5000
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`))
