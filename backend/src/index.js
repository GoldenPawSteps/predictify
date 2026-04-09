const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/auth', require('./routes/auth'));
app.use('/markets', require('./routes/markets'));
app.use('/trades', require('./routes/trades'));
app.use('/settlement', require('./routes/settlement'));
app.use('/portfolio', require('./routes/portfolio'));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
