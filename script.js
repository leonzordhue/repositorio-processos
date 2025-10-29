// Sistema de Gerenciamento de Documentos
class DocumentManager {
    constructor() {
        this.documentos = JSON.parse(localStorage.getItem('documentosSeinfra')) || [];
        this.init();
    }

    init() {
        this.carregarProcessosNoSelect();
        this.atualizarEstatisticas();
        this.renderizarDocumentos();
        this.configurarEventListeners();
    }

    configurarEventListeners() {
        // Busca em tempo real
        document.getElementById('searchInput').addEventListener('input', (e) => {
            if (e.target.value.length >= 2) {
                this.realizarBusca(e.target.value);
            } else if (e.target.value.length === 0) {
                this.renderizarDocumentos();
            }
        });

        // Busca com Enter
        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.realizarBusca(e.target.value);
            }
        });
    }

    carregarProcessosNoSelect() {
        const select = document.getElementById('despachoProcesso');
        select.innerHTML = '<option value="">Selecione um processo...</option>';
        
        const processos = this.documentos.filter(doc => doc.tipo === 'processo');
        
        processos.forEach(processo => {
            const option = document.createElement('option');
            option.value = processo.id;
            option.textContent = `${processo.numero} - ${processo.descricao}`;
            select.appendChild(option);
        });
    }

    adicionarProcesso() {
        const numero = document.getElementById('processoNumero').value.trim();
        const descricao = document.getElementById('processoDescricao').value.trim();
        const arquivoInput = document.getElementById('processoUpload');

        if (!numero || !descricao || !arquivoInput.files[0]) {
            alert('Por favor, preencha todos os campos do processo.');
            return;
        }

        // Verificar se número já existe
        if (this.documentos.find(doc => doc.numero === numero && doc.tipo === 'processo')) {
            alert('Já existe um processo com este número.');
            return;
        }

        const novoProcesso = {
            id: this.gerarId(),
            tipo: 'processo',
            numero: numero,
            descricao: descricao,
            arquivo: {
                nome: arquivoInput.files[0].name,
                tipo: arquivoInput.files[0].type,
                // Em produção, aqui faríamos upload para o Google Drive
                url: URL.createObjectURL(arquivoInput.files[0])
            },
            dataCriacao: new Date().toLocaleDateString('pt-BR'),
            despachos: [] // Array para armazenar IDs dos despachos relacionados
        };

        this.documentos.push(novoProcesso);
        this.salvarNoLocalStorage();
        this.carregarProcessosNoSelect();
        this.atualizarEstatisticas();
        this.renderizarDocumentos();
        this.limparFormularioProcesso();
        
        alert('Processo adicionado com sucesso!');
    }

    adicionarDespacho() {
        const processoId = document.getElementById('despachoProcesso').value;
        const tipo = document.getElementById('despachoTipo').value;
        const arquivoInput = document.getElementById('despachoUpload');

        if (!processoId || !arquivoInput.files[0]) {
            alert('Por favor, selecione um processo e um arquivo.');
            return;
        }

        const processo = this.documentos.find(doc => doc.id === processoId);
        if (!processo) {
            alert('Processo não encontrado.');
            return;
        }

        const novoDespacho = {
            id: this.gerarId(),
            tipo: 'despacho',
            tipoDocumento: tipo,
            processoId: processoId,
            processoNumero: processo.numero,
            arquivo: {
                nome: arquivoInput.files[0].name,
                tipo: arquivoInput.files[0].type,
                url: URL.createObjectURL(arquivoInput.files[0])
            },
            dataCriacao: new Date().toLocaleDateString('pt-BR')
        };

        // Adicionar despacho ao array principal
        this.documentos.push(novoDespacho);
        
        // Vincular despacho ao processo
        processo.despachos.push(novoDespacho.id);
        
        this.salvarNoLocalStorage();
        this.atualizarEstatisticas();
        this.renderizarDocumentos();
        this.limparFormularioDespacho();
        
        alert('Despacho adicionado e vinculado ao processo!');
    }

    realizarBusca(termo) {
        if (!termo.trim()) {
            this.renderizarDocumentos();
            return;
        }

        const resultados = this.documentos.filter(doc => {
            const busca = termo.toLowerCase();
            return (
                doc.numero.toLowerCase().includes(busca) ||
                doc.descricao.toLowerCase().includes(busca) ||
                (doc.tipoDocumento && doc.tipoDocumento.toLowerCase().includes(busca)) ||
                doc.arquivo.nome.toLowerCase().includes(busca)
            );
        });

        this.renderizarDocumentos(resultados);
    }

    renderizarDocumentos(documentos = null) {
        const grid = document.getElementById('documentsGrid');
        const docsParaRenderizar = documentos || this.documentos;

        if (docsParaRenderizar.length === 0) {
            grid.innerHTML = `
                <div class="no-documents">
                    <i class="fas fa-folder-open" style="font-size: 3em; margin-bottom: 20px; color: #bdc3c7;"></i>
                    <h3>Nenhum documento encontrado</h3>
                    <p>Adicione processos e despachos usando os formulários acima.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = docsParaRenderizar.map(doc => this.criarCardDocumento(doc)).join('');
    }

    criarCardDocumento(doc) {
        const isProcesso = doc.tipo === 'processo';
        const despachosRelacionados = isProcesso ? 
            this.documentos.filter(d => d.processoId === doc.id) : 
            [];

        return `
            <div class="document-card ${doc.tipo} ${despachosRelacionados.length > 0 ? 'pareado' : ''}">
                <div class="document-header">
                    <span class="document-badge badge-${doc.tipo}">
                        ${isProcesso ? 'PDF' : 'WORD'} - ${isProcesso ? 'PROCESSO' : doc.tipoDocumento.toUpperCase()}
                    </span>
                    <div class="document-actions">
                        <button class="action-btn btn-view" onclick="documentManager.visualizarDocumento('${doc.id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="action-btn btn-download" onclick="documentManager.baixarDocumento('${doc.id}')">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="action-btn btn-delete" onclick="documentManager.excluirDocumento('${doc.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                
                <div class="document-number">
                    <i class="fas fa-hashtag"></i> ${doc.numero}
                </div>
                
                <div class="document-description">
                    ${doc.descricao}
                </div>
                
                <div class="document-meta">
                    <span><i class="far fa-calendar"></i> ${doc.dataCriacao}</span>
                    <span><i class="far fa-file"></i> ${doc.arquivo.nome}</span>
                </div>

                ${isProcesso && doc.despachos.length > 0 ? `
                    <div class="document-relationship">
                        <strong><i class="fas fa-link"></i> Documentos Vinculados:</strong>
                        ${doc.despachos.map(despachoId => {
                            const despacho = this.documentos.find(d => d.id === despachoId);
                            return despacho ? `
                                <div class="relationship-item">
                                    <span>${despacho.tipoDocumento} - ${despacho.arquivo.nome}</span>
                                    <button class="action-btn btn-view" onclick="documentManager.visualizarDocumento('${despacho.id}')">
                                        <i class="fas fa-external-link-alt"></i>
                                    </button>
                                </div>
                            ` : '';
                        }).join('')}
                    </div>
                ` : ''}

                ${!isProcesso ? `
                    <div class="document-relationship">
                        <strong><i class="fas fa-link"></i> Vinculado ao processo:</strong>
                        <div class="relationship-item">
                            <span>${doc.processoNumero}</span>
                            <button class="action-btn btn-view" onclick="documentManager.visualizarProcesso('${doc.processoId}')">
                                <i class="fas fa-external-link-alt"></i>
                            </button>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    visualizarDocumento(id) {
        const doc = this.documentos.find(d => d.id === id);
        if (!doc) return;

        const modal = document.getElementById('documentModal');
        const modalContent = document.getElementById('modalContent');

        modalContent.innerHTML = `
            <h2>${doc.tipo === 'processo' ? 'Processo' : 'Despacho'} - ${doc.numero}</h2>
            <div class="document-details">
                <p><strong>Descrição:</strong> ${doc.descricao}</p>
                <p><strong>Data de Criação:</strong> ${doc.dataCriacao}</p>
                <p><strong>Arquivo:</strong> ${doc.arquivo.nome}</p>
                ${doc.tipo === 'despacho' ? `<p><strong>Tipo:</strong> ${doc.tipoDocumento}</p>` : ''}
            </div>
            <div class="modal-actions">
                <button onclick="documentManager.baixarDocumento('${doc.id}')" class="upload-btn pdf-btn">
                    <i class="fas fa-download"></i> Baixar Documento
                </button>
                ${doc.tipo === 'processo' ? `
                    <button onclick="documentManager.visualizarDespachos('${doc.id}')" class="upload-btn word-btn">
                        <i class="fas fa-list"></i> Ver Despachos Vinculados
                    </button>
                ` : ''}
            </div>
        `;

        modal.style.display = 'block';
    }

    visualizarProcesso(id) {
        const processo = this.documentos.find(d => d.id === id && d.tipo === 'processo');
        if (processo) {
            this.visualizarDocumento(processo.id);
        }
    }

    visualizarDespachos(processoId) {
        const despachos = this.documentos.filter(d => d.processoId === processoId);
        const modal = document.getElementById('documentModal');
        const modalContent = document.getElementById('modalContent');

        modalContent.innerHTML = `
            <h2>Despachos Vinculados</h2>
            <div class="despachos-list">
                ${despachos.map(despacho => `
                    <div class="despacho-item">
                        <strong>${despacho.tipoDocumento}</strong>
                        <span>${despacho.arquivo.nome}</span>
                        <button onclick="documentManager.baixarDocumento('${despacho.id}')" class="action-btn btn-download">
                            <i class="fas fa-download"></i>
                        </button>
                    </div>
                `).join('')}
            </div>
        `;

        modal.style.display = 'block';
    }

    baixarDocumento(id) {
        const doc = this.documentos.find(d => d.id === id);
        if (doc && doc.arquivo.url) {
            const a = document.createElement('a');
            a.href = doc.arquivo.url;
            a.download = doc.arquivo.nome;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else {
            alert('Arquivo não disponível para download.');
        }
    }

    excluirDocumento(id) {
        if (!confirm('Tem certeza que deseja excluir este documento?')) {
            return;
        }

        const doc = this.documentos.find(d => d.id === id);
        
        // Se for um processo, remover referências nos despachos
        if (doc.tipo === 'processo') {
            this.documentos = this.documentos.filter(d => d.processoId !== id);
        }
        
        // Se for um despacho, remover referência no processo
        if (doc.tipo === 'despacho') {
            const processo = this.documentos.find(d => d.id === doc.processoId);
            if (processo) {
                processo.despachos = processo.despachos.filter(dId => dId !== id);
            }
        }

        // Remover o documento
        this.documentos = this.documentos.filter(d => d.id !== id);
        
        this.salvarNoLocalStorage();
        this.carregarProcessosNoSelect();
        this.atualizarEstatisticas();
        this.renderizarDocumentos();
        
        alert('Documento excluído com sucesso!');
    }

    filterDocuments(filterType) {
        let documentosFiltrados = [];

        switch (filterType) {
            case 'all':
                documentosFiltrados = this.documentos;
                break;
            case 'pareados':
                documentosFiltrados = this.documentos.filter(doc => 
                    doc.tipo === 'processo' && doc.despachos.length > 0
                );
                break;
            case 'processos':
                documentosFiltrados = this.documentos.filter(doc => doc.tipo === 'processo');
                break;
            case 'despachos':
                documentosFiltrados = this.documentos.filter(doc => doc.tipo === 'despacho');
                break;
        }

        this.renderizarDocumentos(documentosFiltrados);
        
        // Atualizar botões ativos
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');
    }

    atualizarEstatisticas() {
        const totalProcessos = this.documentos.filter(d => d.tipo === 'processo').length;
        const totalDespachos = this.documentos.filter(d => d.tipo === 'despacho').length;
        const totalPareados = this.documentos.filter(d => 
            d.tipo === 'processo' && d.despachos.length > 0
        ).length;

        document.getElementById('totalProcessos').textContent = totalProcessos;
        document.getElementById('totalDespachos').textContent = totalDespachos;
        document.getElementById('totalPareados').textContent = totalPareados;
    }

    limparFormularioProcesso() {
        document.getElementById('processoNumero').value = '';
        document.getElementById('processoDescricao').value = '';
        document.getElementById('processoUpload').value = '';
    }

    limparFormularioDespacho() {
        document.getElementById('despachoProcesso').value = '';
        document.getElementById('despachoTipo').value = 'despacho';
        document.getElementById('despachoUpload').value = '';
    }

    gerarId() {
        return Date.now().toString() + Math.random().toString(36).substr(2, 9);
    }

    salvarNoLocalStorage() {
        localStorage.setItem('documentosSeinfra', JSON.stringify(this.documentos));
    }
}

// Funções globais
function performSearch() {
    const termo = document.getElementById('searchInput').value;
    documentManager.realizarBusca(termo);
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    documentManager.renderizarDocumentos();
}

function closeModal() {
    document.getElementById('documentModal').style.display = 'none';
}

function adicionarProcesso() {
    documentManager.adicionarProcesso();
}

function adicionarDespacho() {
    documentManager.adicionarDespacho();
}

function filterDocuments(filterType) {
    documentManager.filterDocuments(filterType);
}

// Inicializar a aplicação quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    window.documentManager = new DocumentManager();
});

// Fechar modal clicando fora dele
window.onclick = function(event) {
    const modal = document.getElementById('documentModal');
    if (event.target === modal) {
        closeModal();
    }
}