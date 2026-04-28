import { useMemo, useState } from 'react';
const SearchIcon         = () => <span>🔍</span>;
const AddCircleIcon      = () => <span>＋</span>;
const EventAvailableIcon = () => <span>📅</span>;
const PhoneIcon          = () => <span>📞</span>;
const PersonIcon         = () => <span>👤</span>;
import './Agenda.css';

const initialClients = [
    { id: 1, name: 'El Bettaieb', phone: '+216 22 123 456' },
    { id: 2, name: 'Malaki', phone: '+216 55 987 210' },
    { id: 3, name: 'Al Aswad', phone: '+216 98 400 700' },
    { id: 4, name: 'Sami Ben Salah', phone: '+216 20 333 222' },
    { id: 5, name: 'Meriem Trabelsi', phone: '+216 93 777 101' },
];

const defaultDate = '2026-04-10';

const Agenda = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [appointments, setAppointments] = useState([
        {
            id: 1,
            clientName: 'El Bettaieb',
            phone: '+216 22 123 456',
            status: 'CONFIRMED',
            date: defaultDate,
            time: '10:30',
        },
        {
            id: 2,
            clientName: 'Malaki',
            phone: '+216 55 987 210',
            status: 'CONFIRMED',
            date: defaultDate,
            time: '11:15',
        },
        {
            id: 3,
            clientName: 'Al Aswad',
            phone: '+216 98 400 700',
            status: 'CONFIRMED',
            date: defaultDate,
            time: '14:00',
        },
    ]);

    const [form, setForm] = useState({
        clientId: '',
        date: defaultDate,
        time: '09:00',
        status: 'CONFIRMED',
    });

    const filteredClients = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        if (!query) return initialClients;

        return initialClients.filter((client) => {
            const normalizedName = client.name.toLowerCase();
            const normalizedPhone = client.phone.replace(/\s+/g, '');
            const normalizedQuery = query.replace(/\s+/g, '');
            return normalizedName.includes(query) || normalizedPhone.includes(normalizedQuery);
        });
    }, [searchTerm]);

    const createAppointment = (client) => {
        const nextAppointment = {
            id: Date.now(),
            clientName: client.name,
            phone: client.phone,
            status: form.status,
            date: form.date,
            time: form.time,
        };
        setAppointments((prev) => [nextAppointment, ...prev]);
        setForm((prev) => ({ ...prev, clientId: String(client.id) }));
    };

    const handleManualCreate = (e) => {
        e.preventDefault();
        const selected = initialClients.find((client) => client.id === Number(form.clientId));
        if (!selected) return;
        createAppointment(selected);
    };

    return (
        <div className="agenda-page">
            <header className="agenda-header">
                <p className="agenda-kicker">Agenda clients</p>
                <h2>Rendez-vous</h2>
                <p className="agenda-subtitle">
                    Recherche par nom ou telephone, puis creation rapide avec l'icone d'ajout.
                </p>
            </header>

            <div className="agenda-layout">
                <section className="agenda-card">
                    <div className="agenda-card-head">
                        <h3>Recherche client</h3>
                    </div>

                    <label className="agenda-search">
                        <SearchIcon fontSize="small" />
                        <input
                            type="text"
                            placeholder="Rechercher par nom ou phone number..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </label>

                    <div className="client-list">
                        {filteredClients.length === 0 ? (
                            <div className="empty-state">Aucun client trouve.</div>
                        ) : (
                            filteredClients.map((client) => (
                                <div key={client.id} className="client-row">
                                    <div className="client-main">
                                        <div className="client-name"><PersonIcon fontSize="small" /> {client.name}</div>
                                        <div className="client-phone"><PhoneIcon fontSize="small" /> {client.phone}</div>
                                    </div>
                                    <button
                                        type="button"
                                        className="icon-add-btn"
                                        title="Creer un rendez-vous"
                                        onClick={() => createAppointment(client)}
                                    >
                                        <AddCircleIcon />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                <section className="agenda-card">
                    <div className="agenda-card-head">
                        <h3>Creer rendez-vous</h3>
                        <EventAvailableIcon />
                    </div>

                    <form className="create-form" onSubmit={handleManualCreate}>
                        <select
                            value={form.clientId}
                            onChange={(e) => setForm((prev) => ({ ...prev, clientId: e.target.value }))}
                        >
                            <option value="">Selectionner un client</option>
                            {initialClients.map((client) => (
                                <option key={client.id} value={client.id}>{client.name} ({client.phone})</option>
                            ))}
                        </select>

                        <div className="form-grid">
                            <input
                                type="date"
                                value={form.date}
                                onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                            />
                            <input
                                type="time"
                                value={form.time}
                                onChange={(e) => setForm((prev) => ({ ...prev, time: e.target.value }))}
                            />
                        </div>

                        <select
                            value={form.status}
                            onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                        >
                            <option value="CONFIRMED">Confirme</option>
                            <option value="PENDING">En attente</option>
                        </select>

                        <button type="submit" className="create-btn">
                            <AddCircleIcon fontSize="small" /> Ajouter le rendez-vous
                        </button>
                    </form>
                </section>
            </div>

            <section className="agenda-card">
                <div className="agenda-card-head">
                    <h3>Liste des rendez-vous (agenda)</h3>
                </div>

                <div className="appointments-grid">
                    {appointments.map((item) => (
                        <article key={item.id} className="appointment-card">
                            <div className="appointment-top">
                                <span className={`status-chip ${item.status === 'CONFIRMED' ? 'ok' : 'pending'}`}>
                                    {item.status === 'CONFIRMED' ? 'Confirme' : 'Pending'}
                                </span>
                                <span className="appointment-date">{item.date} - {item.time}</span>
                            </div>
                            <h4>{item.clientName}</h4>
                            <p>{item.phone}</p>
                        </article>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default Agenda;
