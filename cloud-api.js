        if (location.pathname.endsWith('HOME.html')) {
          const backup = document.createElement('button');
          backup.textContent = 'EXPORT DATA';
          backup.className = 'cloud-export';

          backup.onclick = async () => {
            try {
              const data = await window.CloudAPI.read('export');

              const blob = new Blob(
                [JSON.stringify(data, null, 2)],
                { type: 'application/json' }
              );

              const link = document.createElement('a');
              link.href = URL.createObjectURL(blob);
              link.download =
                'CLOUD-operations-' + window.CloudAPI.today() + '.json';

              link.click();

              setTimeout(() => URL.revokeObjectURL(link.href), 1000);
            } catch (e) {
              window.CloudAPI.showError(e);
            }
          };

          bar.prepend(backup);
        }
