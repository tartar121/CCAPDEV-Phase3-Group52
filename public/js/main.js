// public/js/main.js

// Toggle password visibility (Login/Register)
function toggleVisibility(id, btn) {
    const field = document.getElementById(id);
    const icon = btn.querySelector("i");
    if (field.type === "password") { 
        field.type = "text"; 
        icon.classList.replace("bi-eye", "bi-eye-slash"); 
    } else { 
        field.type = "password"; 
        icon.classList.replace("bi-eye-slash", "bi-eye"); 
    }
}
