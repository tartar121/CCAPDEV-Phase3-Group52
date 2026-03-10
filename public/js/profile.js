// /public/js/profile.js

// Edit Bio Logic
function editMyBio() {
    const newBio = prompt("Enter your new bio:");
    if (newBio) {
        fetch('/profile/update-bio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bio: newBio })
        }).then(res => {
            if (res.ok) location.reload(); // Refresh to show the updated data
        });
    }
}

// Edit Photo Logic
function editPhoto() {
    const newUrl = prompt("Enter new photo URL:");
    if (newUrl) {
        fetch('/profile/update-photo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ photo: newUrl })
        }).then(res => {
            if (res.ok) location.reload(); // Refresh to show the updated photo
        });
    }
}

// Delete Account Logic
function deleteAccount() {
    if (confirm("Delete account? This will wipe your profile and all your reservations.")) {
        // Must be POST because app.js says app.post('/profile/delete'...)
        fetch('/profile/delete', { method: 'POST' })
            .then(() => window.location.href = '/login');
    }
}
