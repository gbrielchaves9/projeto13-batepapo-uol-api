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


const PORT = 5000
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`))
