# nfce-reader-rj
Lê a NFC-e do RJ a partir da URL do QR ou da chave. Leitura por âncoras, validação (soma = total, chave, CNPJ, data), versão do leitor registrada em `receipts.parser_version`. Não contorna captcha. Em falha, grava em `pending_receipts`.
Aceita os domínios `consultadfe.fazenda.rj.gov.br` e `www4.fazenda.rj.gov.br`.
