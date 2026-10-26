import { app } from './app';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Ciaran Manga API Server running at http://localhost:${PORT}`);
});
