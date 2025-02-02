document.addEventListener('DOMContentLoaded', () => {
  fetch('websites.json')
      .then(response => response.json())
      .then(data => {
          const container = document.getElementById('categories-container');
          loadCategories(data.categories, container); // Pass the container element
      });
});

function loadCategories(categories, container, depth = 0) { // Add container parameter
  categories.forEach(item => {
      const wrapper = document.createElement('div');
      wrapper.className = `category-level-${depth}`;

      const title = document.createElement(depth === 0 ? 'h2' : 'h3');
      title.className = depth === 0 ? 'category-title' : 'subcategory-title';
      title.textContent = item.name;
      wrapper.appendChild(title);

      if (item.subcategories) {
          loadCategories(item.subcategories, wrapper, depth + 1); // Pass wrapper as container
      }

      if (item.websites) {
          wrapper.appendChild(createCarousel(item.websites));
      }

      container.appendChild(wrapper); // Append to the correct container
  });
}

function createCarousel(websites) {
  const carousel = document.createElement('div');
  carousel.className = 'carousel';

  websites.forEach(website => {
      const card = document.createElement('div');
      card.className = 'website-card';
      card.innerHTML = `
          <h3>${website.name}</h3>
          ${website.description ? `<p>${website.description}</p>` : ''}
          <a href="${website.url}" target="_blank">Visit Website</a>
      `;
      carousel.appendChild(card);
  });

  return carousel;
}