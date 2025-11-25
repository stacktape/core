import { border, boxShadow } from '../../styles/variables';

export function ConfigEditor() {
  return (
    <section
      css={{
        maxWidth: '1150px',
        margin: '0 auto'
      }}
    >
      <div css={{ display: 'flex', justifyContent: 'center' }}>
        <iframe
          css={{
            boxShadow,
            border,
            background: 'rgb(30, 30, 30)',
            borderRadius: '8px'
          }}
          width={1000}
          height={500}
          src="https://console.stacktape.com/config-editor"
          title="Stacktape config editor"
        />
      </div>
    </section>
  );
}
