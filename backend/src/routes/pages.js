const path = require('path');

async function pagesRoutes(fastify) {
  // Serve static HTML pages
  const pages = {
    '/': 'index.html',
    '/boutique': 'boutique.html',
    '/produit/:slug': 'produit.html',
    '/panier': 'panier.html',
    '/checkout': 'checkout.html',
    '/compte': 'compte.html',
    '/admin': 'admin.html',
    '/contact': 'contact.html',
    '/cgvs': 'cgvs.html',
    '/editpage': 'editpage.html'
  };

  Object.entries(pages).forEach(([route, file]) => {
    fastify.get(route, async (request, reply) => {
      return reply.sendFile(file);
    });
  });

  // Serve uploads with path validation
  fastify.get('/uploads/:category/:slug/:file', async (request, reply) => {
    const { category, slug, file } = request.params;
    
    // Validate category
    const allowedCategories = ['bijoux', 'vetements', 'accessoires', 'chaussures'];
    if (!allowedCategories.includes(category)) {
      return reply.code(404).send({ error: 'Category not found' });
    }

    // Prevent directory traversal
    if (slug.includes('..') || slug.includes('/') || file.includes('..') || file.includes('/')) {
      return reply.code(400).send({ error: 'Invalid path' });
    }

    const filePath = path.join('uploads', category, slug, file);
    return reply.sendFile(filePath);
  });
}

module.exports = pagesRoutes;