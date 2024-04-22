function showResults(value) {
    const resultsContainer = document.getElementById('searchResults');

    if (!value) {
        resultsContainer.innerHTML = '';
        return;
    }

    // Adding headers to explicitly set the request as AJAX
    fetch(`/search?query=${encodeURIComponent(value)}`, {
        headers: {
            'X-Requested-With': 'XMLHttpRequest' // Important for Flask to recognize this as an AJAX request
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        if (data.length === 0) {
            resultsContainer.innerHTML = '<div class="list-group-item">No results found</div>';
            return;
        }
        let results = data.map(company => `<a href="/company/${company.slug}" class="list-group-item list-group-item-action">${company.name}</a>`).join('');
        resultsContainer.innerHTML = `<div class="list-group">${results}</div>`;
    })
    .catch(error => {
        console.error('Error loading the search results:', error);
        resultsContainer.innerHTML = '<div class="list-group-item">Error loading results</div>';
    });
}

document.getElementById('search-input').addEventListener('input', (e) => showResults(e.target.value));
