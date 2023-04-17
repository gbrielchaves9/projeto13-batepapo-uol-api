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

const mongoClient = new MongoClient(process.env.DATABASE_URL)
try {
    await mongoClient.connect()
    console.log("conectado !")
} catch (err) {
    console.log(err.message)
}

const db = mongoClient.db()

app.post("/participants", async (req, res) => {
    const { name } = req.body

    const nameSchema = Joi.object({
        name: Joi.string().min(1).required()
    });

    const validation = nameSchema.validate(req.body, { abortEarly: false });

    if (validation.error) {
        console.log(validation.error.details);
        return res.status(422).send("precisa de um nome");
    }

    const participant = await db.collection("participants").findOne({ name: name });
    if (participant) {

        return res.status(409).send("Usuário já está online");
    }

    try {
        const participantObject = {
            name: name,
            lastStatus: Date.now()
        };
        const participantResult = await db.collection("participants").insertOne(participantObject);

        const message = {
            from: name,
            to: "Todos",
            text: "entra na sala...",
            type: "status",
            time: dayjs().format("HH:mm:ss")
        };

        const messageResult = await db.collection("messages").insertOne(message);

        res.status(201).send({ id: participantResult.insertedId, name, message });
    } catch (err) {
        console.log(err);
        res.status(500).send("Erro ao inserir participante no banco de dados");
    }
});

app.get("/participants", async (req, res) => {
    try {
        const participants = await db.collection("participants").find().toArray();
        res.send(participants);
    } catch (err) {
        console.log(err);
        res.status(500).send("Erro ao buscar participantes");
    }
});


app.post("/messages", async (req, res) => {
    const messageSchema = Joi.object({
        to: Joi.string().min(1).required(),
        text: Joi.string().min(1).required(),
        type: Joi.string().valid('message', 'private_message').required(),
      });
      
      const from = req.header('User');
      const participant = await db.collection('participants').findOne({ name: from });
      if (!participant) {
        return res.status(404).send('Remetente não encontrado');
      }
      
      const message = {
        from,
        to,
        text,
        type,
        time: dayjs().format("HH:mm:ss")
      };
      
      try {
        const result = await db.collection('messages').insertOne(message);
        res.sendStatus(201);
      } catch (err) {
        console.error(err);
        res.sendStatus(500);
      }
});

app.get('/messages', async (req, res) => {
    const user = req.header('User');
    let limit = req.query.limit || 0; 
    if (isNaN(limit) || limit <= 0) {
      return res.status(422).send('Limite inválido');
    }
    limit = parseInt(limit);
    const query = {
      $or: [
        { to: user },
        { from: user },
        { to: 'Todos', type: 'message' },
        { type: 'private_message', $or: [{ to: user }, { from: user }] },
      ]
    };
    
    const messages = await db.collection('messages')
      .find(query)
      .sort({ _id: -1 }) 
      .limit(limit)
      .toArray();
  
    res.send(messages);
  });


  app.post('/status',async (req, res) => {
    const user = req.header('User');
    
    if (!user) {
      return res.status(404).send();
    }
    
    const participant = await db.collection('participants').findOne({ name: user })
    
    if (!participant) {
      return res.status(404).send();
    }
    
    participant.lastStatus = Date.now();
    
    res.status(200).send();
  });

  setInterval(async () => {
    const cutoff = new Date(Date.now() - 10000); // Define o limite de tempo para 10 segundos atrás
    const inactiveParticipants = await db.collection('participants').find({ lastStatus: { $lt: cutoff } }).toArray();
    if (inactiveParticipants.length > 0) {
      await db.collection('participants').deleteMany({ lastStatus: { $lt: cutoff } });
      const currentTime = new Date().toLocaleTimeString('pt-BR');
      inactiveParticipants.forEach(async (participant) => {
        const message = {
          from: participant.name,
          to: 'Todos',
          text: 'sai da sala...',
          type: 'status',
          time: currentTime
        };
        await db.collection('messages').insertOne(message);
      });
    }
  }, 15000);



const PORT = 5000
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`))
