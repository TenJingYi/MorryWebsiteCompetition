function showPreview(portalName) {
    const modal = document.getElementById('login-modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');

    if (portalName === 'Family Portal') {
        title.innerText = '👨‍👩‍👧 Family Portal Preview';
        body.innerHTML = 'The Family Portal allows children to monitor medication history, review emotional check-ins, and upload family photos for MORY’s memory profile.';
    } else if (portalName === 'Caregiver Hub') {
        title.innerText = '🩺 Caregiver Hub Preview';
        body.innerHTML = 'The Caregiver Hub offers an icon-heavy task checklist with multi-language support (Bahasa, Tagalog, Burmese) for easy daily logging.';
    }

    modal.style.display = 'flex';
}

function closeModal() {
    document.getElementById('login-modal').style.display = 'none';
}